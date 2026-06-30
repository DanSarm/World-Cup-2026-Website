/**
 * Diagnose Netherlands vs Morocco match, Daniel Sarmiento pick, and profile vs leaderboard.
 */
import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const {
    getMatchesWithTeams,
    getPlayers,
    getPredictions,
    getAdjustments,
    getTournamentPodiumPredictions,
    getFinalsPredictions,
    getActualResults,
    getTeams,
  } = await import("../lib/data");
  const { getSettings } = await import("../lib/auth");
  const {
    calculateLeaderboard,
    scoreMatchPrediction,
    scoringConfigFromSettings,
  } = await import("../lib/scoring");
  const { buildProjectedPrizes } = await import("../lib/payouts");
  const { isMatchDecidedForScoring } = await import("../lib/matchLive");
  const { isConfirmedPick, getEffectiveMatchPrediction } = await import(
    "../lib/pickUtils"
  );
  const {
    buildPlayerPickSummariesWithConfig,
    computePlayerPickStats,
  } = await import("../lib/playerProfile");
  const { computePlayerPickStats: pickStats } = await import(
    "../lib/playerPickStats"
  );

  const [
    matches,
    players,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    actualResults,
    settings,
    teams,
  ] = await Promise.all([
    getMatchesWithTeams(),
    getPlayers(),
    getPredictions(),
    getTournamentPodiumPredictions(),
    getFinalsPredictions(),
    getAdjustments(),
    getActualResults(),
    getSettings(),
    getTeams(),
  ]);

  const scoringConfig = scoringConfigFromSettings(settings);
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
  const projectedPrizes = buildProjectedPrizes(
    players,
    tempLb,
    finalsPredictions,
    actualResults,
    settings
  );
  const leaderboard = calculateLeaderboard(
    players,
    matches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    projectedPrizes,
    teams
  );

  const nedMar = matches.filter((m) => {
    const h = m.home_team?.fifa_code ?? m.home_label;
    const a = m.away_team?.fifa_code ?? m.away_label;
    const codes = new Set([h, a]);
    return (
      (codes.has("NED") || codes.has("Netherlands")) &&
      (codes.has("MAR") || codes.has("Morocco"))
    );
  });

  console.log("=== Netherlands vs Morocco matches ===\n");
  for (const m of nedMar) {
    console.log(
      `M${m.match_number} ${m.home_label} vs ${m.away_label} | ${m.home_score}-${m.away_score} | status=${m.status} | winner=${m.winner_team_id}`
    );
    console.log(`  match_id=${m.id}`);
    console.log(`  home_id=${m.home_team_id} away_id=${m.away_team_id}`);

    const matchPreds = predictions.filter(
      (p) => p.match_id === m.id && isConfirmedPick(p)
    );
    console.log(`  ${matchPreds.length} confirmed picks:\n`);

    for (const p of matchPreds.sort((a, b) => {
      const pa = players.find((x) => x.id === a.player_id);
      const pb = players.find((x) => x.id === b.player_id);
      return (pa?.display_name ?? "").localeCompare(pb?.display_name ?? "");
    })) {
      const player = players.find((x) => x.id === p.player_id);
      const result = scoreMatchPrediction(m, p, scoringConfig);
      const inferred =
        p.pred_home_score > p.pred_away_score
          ? "home"
          : p.pred_away_score > p.pred_home_score
            ? "away"
            : p.pred_winner_team_id
              ? p.pred_winner_team_id === m.home_team_id
                ? "home(tie)"
                : "away(tie)"
              : "tie-no-advancer";
      console.log(
        `  ${player?.display_name}: ${p.pred_home_score}-${p.pred_away_score} advancer=${p.pred_winner_team_id ?? "null"} (${inferred}) | stored pts=${p.points} calc=${result.points} exact=${result.exactScore} correct=${result.correctResult}`
      );
    }
    console.log();
  }

  const daniel = players.find((p) =>
    /daniel.*sarmiento|sarmiento.*daniel/i.test(p.display_name)
  );
  console.log("=== Daniel Sarmiento ===\n");
  if (daniel) {
    console.log(`id=${daniel.id} name=${daniel.display_name}`);
    const danPreds = predictions.filter((p) => p.player_id === daniel.id);
    for (const m of nedMar) {
      const p = danPreds.find((x) => x.match_id === m.id);
      console.log(
        `M${m.match_number}: ${p ? `${p.pred_home_score}-${p.pred_away_score} confirmed=${p.pick_confirmed}` : "NO PICK"}`
      );
    }
  } else {
    console.log("Player not found. All players:");
    for (const p of players) console.log(`  ${p.display_name}`);
  }

  console.log("\n=== Missing picks for M75 ===\n");
  if (nedMar[0]) {
    const m = nedMar[0];
    const picked = new Set(
      predictions
        .filter((p) => p.match_id === m.id && isConfirmedPick(p))
        .map((p) => p.player_id)
    );
    for (const p of players) {
      if (!picked.has(p.id)) console.log(`  ${p.display_name}`);
    }
  }

  console.log("\n=== Profile vs leaderboard (all players) ===\n");
  let mismatches = 0;
  for (const entry of leaderboard) {
    const playerPreds = predictions.filter((p) => p.player_id === entry.playerId);
    const picks = buildPlayerPickSummariesWithConfig(
      entry.playerId,
      matches,
      playerPreds,
      scoringConfig,
      false
    );
    const stats = pickStats(picks);
    const sumPoints = picks
      .filter((p) => p.status === "scored")
      .reduce((s, p) => s + p.points, 0);

    const issues: string[] = [];
    if (stats.exact !== entry.exactScores) {
      issues.push(`exacts profile=${stats.exact} lb=${entry.exactScores}`);
    }
    if (stats.correct !== entry.correctResults - entry.exactScores) {
      issues.push(
        `correct(non-exact) profile=${stats.correct} lb=${entry.correctResults - entry.exactScores}`
      );
    }
    if (sumPoints !== entry.matchPoints) {
      issues.push(`match pts sum=${sumPoints} lb=${entry.matchPoints}`);
    }
    if (entry.totalPoints !== entry.matchPoints + entry.beforeCupPoints + entry.manualAdjustments) {
      issues.push(`total mismatch components`);
    }

    if (issues.length) {
      mismatches++;
      console.log(`${entry.displayName}: ${issues.join("; ")}`);
    }
  }
  if (!mismatches) console.log("✓ All players match between profile picks and leaderboard.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
