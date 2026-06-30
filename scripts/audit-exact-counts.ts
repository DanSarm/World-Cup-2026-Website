/**
 * Compare leaderboard exact counts vs profile pick stats for every player.
 */
import { resolve } from "path";

async function auditMode(
  label: string,
  matches: Awaited<ReturnType<typeof import("../lib/data").getMatchesWithTeams>>,
  leaderboard: import("../lib/types").LeaderboardEntry[],
  hasLiveScoring: boolean,
  players: import("../lib/types").Player[],
  predictions: import("../lib/types").MatchPrediction[],
  podiumPredictions: import("../lib/types").TournamentPodiumPrediction[],
  finalsPredictions: import("../lib/types").FinalsChallengePrediction[],
  adjustments: import("../lib/types").ManualAdjustment[],
  actualResults: import("../lib/types").ActualTournamentResults,
  settings: import("../lib/types").Settings,
  teams: import("../lib/types").Team[]
) {
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
  const { buildPlayerPickSummariesWithConfig } = await import(
    "../lib/playerProfile"
  );
  const { computePlayerPickStats, pickStatsFromLeaderboardEntry } = await import(
    "../lib/playerPickStats"
  );

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
  const lbFresh = calculateLeaderboard(
    players,
    matches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    projectedPrizes,
    teams,
    { includeLiveScores: hasLiveScoring }
  );

  console.log(`=== ${label} (hasLiveScoring=${hasLiveScoring}) ===\n`);

  let mismatchCount = 0;

  for (const entry of lbFresh) {
    const playerPreds = predictions.filter((p) => p.player_id === entry.playerId);
    const picks = buildPlayerPickSummariesWithConfig(
      entry.playerId,
      matches,
      playerPreds,
      scoringConfig,
      hasLiveScoring
    );
    const pickStats = pickStatsFromLeaderboardEntry(picks, entry);
    const filterExactCount = picks.filter(
      (p) => p.status === "scored" && p.exactScore
    ).length;

    const bundleEntry = leaderboard.find((e) => e.playerId === entry.playerId);

    const issues: string[] = [];
    if (entry.exactScores !== pickStats.exact) {
      issues.push(`header pickStats ${pickStats.exact} vs lb ${entry.exactScores}`);
    }
    if (entry.exactScores !== filterExactCount) {
      issues.push(
        `exact filter ${filterExactCount} vs lb ${entry.exactScores}`
      );
    }
    if (bundleEntry && bundleEntry.exactScores !== entry.exactScores) {
      issues.push(
        `bundle lb ${bundleEntry.exactScores} vs recalc lb ${entry.exactScores}`
      );
    }

    if (issues.length) {
      mismatchCount++;
      console.log(`${entry.displayName}:`);
      for (const i of issues) console.log(`  ${i}`);

      if (/david sarmiento/i.test(entry.displayName)) {
        console.log("  David exact picks:");
        for (const pick of picks.filter((p) => p.exactScore)) {
          console.log(
            `    M${pick.matchNumber} status=${pick.status} pts=${pick.points} live=${pick.livePoints}`
          );
        }
        const predByMatch = new Map(playerPreds.map((p) => [p.match_id, p]));
        console.log("  Leaderboard exact matches:");
        for (const match of matches) {
          const pred = predByMatch.get(match.id);
          const effective = getEffectiveMatchPrediction(match, pred);
          if (!effective || !pred || !isConfirmedPick(pred)) continue;
          if (!isMatchDecidedForScoring(match)) continue;
          const r = scoreMatchPrediction(match, effective, scoringConfig);
          if (r.exactScore) {
            console.log(`    M${match.match_number} ${effective.pred_home_score}-${effective.pred_away_score} actual ${match.home_score}-${match.away_score}`);
          }
        }
      }
      console.log();
    }
  }

  if (!mismatchCount) {
    console.log("✓ All players aligned\n");
  } else {
    console.log(`✗ ${mismatchCount} mismatch(es)\n`);
  }
  return mismatchCount;
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const {
    getPlayers,
    getPredictions,
    getAdjustments,
    getTournamentPodiumPredictions,
    getFinalsPredictions,
    getActualResults,
    getTeams,
    getLeaderboardData,
  } = await import("../lib/data");
  const { getSettings } = await import("../lib/auth");

  const [
    players,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    actualResults,
    settings,
    teams,
  ] = await Promise.all([
    getPlayers(),
    getPredictions(),
    getTournamentPodiumPredictions(),
    getFinalsPredictions(),
    getAdjustments(),
    getActualResults(),
    getSettings(),
    getTeams(),
  ]);

  const bundleNoLive = await getLeaderboardData({ skipScoreSync: true });
  let total = await auditMode("No live scoring", bundleNoLive.matches, bundleNoLive.leaderboard, bundleNoLive.hasLiveScoring, players, predictions, podiumPredictions, finalsPredictions, adjustments, actualResults, settings, teams);

  const bundleLive = await getLeaderboardData({ includeLiveScores: true });
  total += await auditMode("With live scoring", bundleLive.matches, bundleLive.leaderboard, bundleLive.hasLiveScoring, players, predictions, podiumPredictions, finalsPredictions, adjustments, actualResults, settings, teams);

  if (total > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
