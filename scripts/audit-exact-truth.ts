/**
 * Find exact-count mismatches: leaderboard vs profile pick summaries.
 * Exact = scoring exact (correct score + outcome, including knockout advancer on pens).
 */
import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const {
    getPlayers,
    getPredictions,
    getLeaderboardData,
  } = await import("../lib/data");
  const { getSettings } = await import("../lib/auth");
  const {
    scoreMatchPrediction,
    scoringConfigFromSettings,
  } = await import("../lib/scoring");
  const { isMatchDecidedForScoring } = await import("../lib/matchLive");
  const { isConfirmedPick, getEffectiveMatchPrediction } = await import(
    "../lib/pickUtils"
  );
  const { buildPlayerPickSummariesWithConfig, syncPickScoringFlags } = await import(
    "../lib/playerProfile"
  );

  const bundle = await getLeaderboardData({ skipScoreSync: true });
  const { matches, leaderboard, hasLiveScoring } = bundle;
  const settings = await getSettings();
  const cfg = scoringConfigFromSettings(settings);
  const predictions = await getPredictions();
  const players = await getPlayers();

  console.log("=== Exact truth audit (all players) ===\n");

  let playersWithMismatch = 0;

  for (const player of players) {
    const entry = leaderboard.find((e) => e.playerId === player.id);
    if (!entry) continue;

    const playerPreds = predictions.filter(
      (p) => p.player_id === player.id && isConfirmedPick(p)
    );
    const picks = buildPlayerPickSummariesWithConfig(
      player.id,
      matches,
      playerPreds,
      cfg,
      hasLiveScoring
    );
    syncPickScoringFlags(picks, matches, playerPreds, cfg);

    const filterExacts = picks.filter(
      (p) => p.status === "scored" && p.exactScore
    );

    const lbExacts: string[] = [];
    const predByMatch = new Map(playerPreds.map((p) => [p.match_id, p]));
    for (const match of matches) {
      const pred = predByMatch.get(match.id);
      const effective = getEffectiveMatchPrediction(match, pred);
      if (!effective || !pred || !isConfirmedPick(pred)) continue;
      if (!isMatchDecidedForScoring(match)) continue;
      const r = scoreMatchPrediction(match, effective, cfg);
      if (r.exactScore) {
        lbExacts.push(`M${match.match_number}`);
      }
    }

    const issues: string[] = [];
    if (entry.exactScores !== filterExacts.length) {
      issues.push(
        `filter shows ${filterExacts.length} exact picks, leaderboard says ${entry.exactScores}`
      );
    }
    if (entry.exactScores !== lbExacts.length) {
      issues.push(
        `recalc lb ${lbExacts.length} [${lbExacts.join(",")}] vs entry ${entry.exactScores}`
      );
    }

    if (issues.length) {
      playersWithMismatch++;
      console.log(`${player.display_name}:`);
      for (const i of issues) console.log(`  ${i}`);
      console.log();
    }
  }

  if (!playersWithMismatch) {
    console.log("✓ Exact counts match leaderboard and profile filter everywhere");
  } else {
    console.log(`✗ ${playersWithMismatch} player(s) with mismatches`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
