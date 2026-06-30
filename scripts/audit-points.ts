/**
 * Full points audit: compare stored prediction points vs recalculated values,
 * and verify each player's leaderboard total matches the sum of components.
 *
 * Usage:
 *   npm run audit:points
 *   npm run audit:points -- --fix   # recalculate stored points only (no pick changes)
 */
import { resolve } from "path";

type PredictionMismatch = {
  playerName: string;
  matchNumber: number;
  storedPoints: number | null;
  expectedPoints: number;
  pred: string;
  actual: string;
};

type PlayerTotalMismatch = {
  playerName: string;
  storedMatchSum: number;
  computedMatchPoints: number;
  storedPodium: number;
  computedPodium: number;
  manualAdjustments: number;
  leaderboardTotal: number;
  expectedTotal: number;
};

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const shouldFix = process.argv.includes("--fix");

  const {
    getMatchesWithTeams,
    getPlayers,
    getPredictions,
    getTournamentPodiumPredictions,
    getFinalsPredictions,
    getActualResults,
    getTeams,
    getAdjustments,
    recalculateAllScores,
  } = await import("../lib/data");
  const { getSettings } = await import("../lib/auth");
  const {
    scoreMatchPrediction,
    calculateLeaderboard,
    calculatePodiumPoints,
    scoringConfigFromSettings,
  } = await import("../lib/scoring");
  const { isMatchDecidedForScoring } = await import("../lib/matchLive");
  const { isConfirmedPick, getEffectiveMatchPrediction } = await import(
    "../lib/pickUtils"
  );
  const { buildProjectedPrizes } = await import("../lib/payouts");

  const [
    matches,
    players,
    predictions,
    podiumPredictions,
    finalsPredictions,
    actualResults,
    settings,
    teams,
    adjustments,
  ] = await Promise.all([
    getMatchesWithTeams(),
    getPlayers(),
    getPredictions(),
    getTournamentPodiumPredictions(),
    getFinalsPredictions(),
    getActualResults(),
    getSettings(),
    getTeams(),
    getAdjustments(),
  ]);

  const scoringConfig = scoringConfigFromSettings(settings);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const playerNameById = new Map(players.map((p) => [p.id, p.display_name]));
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const predictionMismatches: PredictionMismatch[] = [];

  for (const pred of predictions) {
    if (!isConfirmedPick(pred)) continue;
    const match = matchById.get(pred.match_id);
    if (!match || !isMatchDecidedForScoring(match)) continue;

    const effective = getEffectiveMatchPrediction(match, pred);
    if (!effective) continue;

    const expected = scoreMatchPrediction(match, effective, scoringConfig);
    const stored = pred.points ?? 0;
    if (stored !== expected.points) {
      predictionMismatches.push({
        playerName: playerNameById.get(pred.player_id) ?? pred.player_id,
        matchNumber: match.match_number,
        storedPoints: pred.points,
        expectedPoints: expected.points,
        pred: `${effective.pred_home_score}-${effective.pred_away_score}`,
        actual: `${match.home_score}-${match.away_score}`,
      });
    }
  }

  const podiumByPlayer = new Map(
    podiumPredictions.map((p) => [p.player_id, p])
  );
  const adjByPlayer = new Map<string, number>();
  for (const adj of adjustments) {
    adjByPlayer.set(
      adj.player_id,
      (adjByPlayer.get(adj.player_id) ?? 0) + adj.points
    );
  }

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

  const playerTotalMismatches: PlayerTotalMismatch[] = [];

  for (const entry of leaderboard) {
    const playerPreds = predictions.filter(
      (p) => p.player_id === entry.playerId && isConfirmedPick(p)
    );

    let storedMatchSum = 0;
    let computedMatchPoints = 0;

    for (const pred of playerPreds) {
      const match = matchById.get(pred.match_id);
      if (!match || !isMatchDecidedForScoring(match)) continue;
      storedMatchSum += pred.points ?? 0;
      const effective = getEffectiveMatchPrediction(match, pred);
      if (!effective) continue;
      computedMatchPoints += scoreMatchPrediction(
        match,
        effective,
        scoringConfig
      ).points;
    }

    const podiumPred = podiumByPlayer.get(entry.playerId);
    const computedPodium = podiumPred
      ? calculatePodiumPoints(podiumPred, actualResults, teamsById).total
      : 0;
    const storedPodium = podiumPred?.points ?? 0;
    const manualAdjustments = adjByPlayer.get(entry.playerId) ?? 0;
    const expectedTotal =
      computedMatchPoints + computedPodium + manualAdjustments;

    if (
      storedMatchSum !== computedMatchPoints ||
      storedPodium !== computedPodium ||
      entry.totalPoints !== expectedTotal
    ) {
      playerTotalMismatches.push({
        playerName: entry.displayName,
        storedMatchSum,
        computedMatchPoints,
        storedPodium,
        computedPodium,
        manualAdjustments,
        leaderboardTotal: entry.totalPoints,
        expectedTotal,
      });
    }
  }

  console.log("=== Family Cup 2026 Points Audit ===\n");
  console.log(`Players: ${players.length}`);
  console.log(
    `Finalized matches: ${matches.filter(isMatchDecidedForScoring).length}`
  );
  console.log(`Confirmed predictions scored: ${predictionMismatches.length} mismatches checked`);

  if (predictionMismatches.length === 0) {
    console.log("\n✓ All stored match prediction points match recalculated values.");
  } else {
    console.log(
      `\n✗ ${predictionMismatches.length} prediction point mismatch(es):`
    );
    for (const row of predictionMismatches) {
      console.log(
        `  ${row.playerName} · M${row.matchNumber}: stored ${row.storedPoints} → expected ${row.expectedPoints} (pick ${row.pred}, actual ${row.actual})`
      );
    }
  }

  if (playerTotalMismatches.length === 0) {
    console.log("\n✓ All player leaderboard totals reconcile correctly.");
  } else {
    console.log(
      `\n✗ ${playerTotalMismatches.length} player total mismatch(es):`
    );
    for (const row of playerTotalMismatches) {
      console.log(`  ${row.playerName}:`);
      if (row.storedMatchSum !== row.computedMatchPoints) {
        console.log(
          `    match points stored sum ${row.storedMatchSum} vs computed ${row.computedMatchPoints}`
        );
      }
      if (row.storedPodium !== row.computedPodium) {
        console.log(
          `    podium stored ${row.storedPodium} vs computed ${row.computedPodium}`
        );
      }
      if (row.leaderboardTotal !== row.expectedTotal) {
        console.log(
          `    leaderboard ${row.leaderboardTotal} vs expected ${row.expectedTotal} (adj ${row.manualAdjustments})`
        );
      }
    }
  }

  if (shouldFix) {
    console.log("\nRunning recalculateAllScores (updates points fields only)...");
    await recalculateAllScores();
    console.log("Done. Re-run audit:points to verify.");
  } else if (predictionMismatches.length > 0 || playerTotalMismatches.length > 0) {
    console.log("\nTo fix stored points only, run: npm run audit:points -- --fix");
  }

  if (predictionMismatches.length > 0 || playerTotalMismatches.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
