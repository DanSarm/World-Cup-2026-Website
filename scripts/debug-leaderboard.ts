/**
 * One-off diagnostic: inspect predictions + leaderboard scoring.
 * Run: npx tsx scripts/debug-leaderboard.ts
 */
import { readFileSync } from "fs";
import { join } from "path";

try {
  const envFile = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* optional */
}

import {
  getPlayers,
  getMatchesWithTeams,
  getPredictions,
  getTournamentPodiumPredictions,
  getFinalsPredictions,
  getAdjustments,
  getActualResults,
  getTeams,
} from "../lib/data";
import { calculateLeaderboard, scoreMatchPrediction, scoringConfigFromSettings } from "../lib/scoring";
import { getSettings } from "../lib/auth";
import { isConfirmedPick } from "../lib/pickUtils";
import { isMatchDecidedForScoring } from "../lib/matchLive";

async function main() {
  const [players, matches, predictions, settings] = await Promise.all([
    getPlayers(),
    getMatchesWithTeams(),
    getPredictions(),
    getSettings(),
  ]);

  console.log("Players:", players.length);
  console.log("Predictions:", predictions.length);
  console.log("Final matches:", matches.filter((m) => m.status === "final").length);
  console.log("Locked matches:", matches.filter((m) => m.status === "locked").length);
  const withScores = matches.filter((m) => m.home_score != null && m.away_score != null);
  console.log("Matches with scores:", withScores.length);
  for (const m of withScores.slice(0, 8)) {
    console.log(
      `  #${m.match_number} ${m.status} ${m.home_label} vs ${m.away_label} ${m.home_score}-${m.away_score}`
    );
  }

  const confirmed = predictions.filter(isConfirmedPick);
  console.log("After isConfirmedPick:", confirmed.length);

  const byConfirmed = { true: 0, false: 0, undefined: 0 };
  for (const p of predictions) {
    if (p.pick_confirmed === true) byConfirmed.true++;
    else if (p.pick_confirmed === false) byConfirmed.false++;
    else byConfirmed.undefined++;
  }
  console.log("pick_confirmed breakdown:", byConfirmed);

  console.log("Decided matches:", matches.filter((m) => isMatchDecidedForScoring(m)).length);
  const finalMatches = matches.filter((m) => isMatchDecidedForScoring(m));
  const scoringConfig = scoringConfigFromSettings(settings);
  let scoredCount = 0;
  let totalPts = 0;
  for (const m of finalMatches) {
    for (const p of predictions) {
      if (!isConfirmedPick(p) || p.match_id !== m.id) continue;
      if (m.home_score === null || m.away_score === null) continue;
      const r = scoreMatchPrediction(m, p, scoringConfig);
      if (r.points > 0) {
        scoredCount++;
        totalPts += r.points;
        const player = players.find((pl) => pl.id === p.player_id);
        console.log(
          `  ${player?.display_name}: ${m.group_letter ?? m.stage} ${m.home_score}-${m.away_score}, pick ${p.pred_home_score}-${p.pred_away_score} => ${r.points}pts (confirmed=${p.pick_confirmed})`
        );
      }
    }
  }
  console.log("Scored picks with points:", scoredCount, "total", totalPts);

  const mexico = matches.find(
    (m) =>
      m.status === "final" &&
      (m.home_label?.toLowerCase().includes("mexico") ||
        m.away_label?.toLowerCase().includes("mexico") ||
        m.home_team?.short_name?.toLowerCase().includes("mex") ||
        m.match_number === 1)
  );
  if (mexico) {
    console.log("\nMexico/first match:", {
      id: mexico.id,
      status: mexico.status,
      score: `${mexico.home_score}-${mexico.away_score}`,
      match_number: mexico.match_number,
    });
    const mexPreds = predictions.filter((p) => p.match_id === mexico.id);
    console.log("Predictions for that match:", mexPreds.length);
    for (const p of mexPreds.slice(0, 5)) {
      const player = players.find((pl) => pl.id === p.player_id);
      console.log(
        `  ${player?.display_name}: ${p.pred_home_score}-${p.pred_away_score} confirmed=${p.pick_confirmed} stored_pts=${p.points}`
      );
    }
  }

  const [podiumPredictions, finalsPredictions, adjustments, actualResults, teams] =
    await Promise.all([
      getTournamentPodiumPredictions(),
      getFinalsPredictions(),
      getAdjustments(),
      getActualResults(),
      getTeams(),
    ]);

  const tempLb = calculateLeaderboard(
    players,
    matches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    new Map(),
    teams
  );
  console.log("\nLeaderboard top 5:");
  for (const e of tempLb.slice(0, 5)) {
    console.log(`  ${e.displayName}: ${e.totalPoints} pts (picksMade=${e.picksMade})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
