import type {
  ActualTournamentResults,
  BigPrediction,
  FinalsChallengePrediction,
  LeaderboardEntry,
  ManualAdjustment,
  Match,
  MatchPrediction,
  MatchStage,
  Player,
  Settings,
  TournamentPodiumPrediction,
} from "./types";
import { isKnockoutStage } from "./types";
import { isConfirmedPick, getEffectiveMatchPrediction } from "./pickUtils";
import { calculateExactScoreFireBonus } from "./fireBonus";
import {
  capGroupMatchPoints,
  outcomeBonusForScoreline,
  scoringConfigFromSettings,
  type ScoringConfig,
  DEFAULT_SCORING_CONFIG,
} from "./scoringConfig";
import { championProbabilityToLongshotBonus } from "./odds/math";

function getKnockoutAdvancePoints(stage: MatchStage): number {
  const map: Partial<Record<MatchStage, number>> = {
    round_of_32: 4,
    round_of_16: 5,
    quarterfinal: 6,
    semifinal: 8,
    third_place: 5,
    final: 10,
  };
  return map[stage] ?? 0;
}

function getResult(
  homeScore: number,
  awayScore: number
): "home" | "away" | "draw" {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

function getMargin(homeScore: number, awayScore: number): number {
  return Math.abs(homeScore - awayScore);
}

export interface ScoreMatchResult {
  points: number;
  exactScore: boolean;
  correctResult: boolean;
  knockoutCorrect: boolean;
  outcomeBonus: number;
  fireBonus: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  basePoints: number;
  exactScoreBonus: number;
  marginBonus: number;
  outcomeBonus: number;
  fireBonus: number;
  perfectDayBonus: number;
  total: number;
}

export { DEFAULT_SCORING_CONFIG, scoringConfigFromSettings };
export type { ScoringConfig };

function groupOutcomeBonus(
  match: Pick<Match, "home_win_bonus" | "draw_bonus" | "away_win_bonus">,
  actualResult: "home" | "away" | "draw"
): number {
  if (actualResult === "home") return match.home_win_bonus ?? 0;
  if (actualResult === "draw") return match.draw_bonus ?? 0;
  return match.away_win_bonus ?? 0;
}

function knockoutAdvanceBonus(
  match: Pick<
    Match,
    "home_team_id" | "away_team_id" | "home_advance_bonus" | "away_advance_bonus"
  >,
  actualWinnerId: string | null
): number {
  if (!actualWinnerId) return 0;
  if (actualWinnerId === match.home_team_id) return match.home_advance_bonus ?? 0;
  if (actualWinnerId === match.away_team_id) return match.away_advance_bonus ?? 0;
  return 0;
}

export function scoreMatchPrediction(
  match: Pick<
    Match,
    | "stage"
    | "home_score"
    | "away_score"
    | "winner_team_id"
    | "home_team_id"
    | "away_team_id"
    | "status"
    | "home_win_bonus"
    | "draw_bonus"
    | "away_win_bonus"
    | "home_advance_bonus"
    | "away_advance_bonus"
  >,
  prediction: Pick<
    MatchPrediction,
    "pred_home_score" | "pred_away_score" | "pred_winner_team_id"
  >,
  scoringConfig: ScoringConfig = DEFAULT_SCORING_CONFIG,
  options?: { allowLive?: boolean }
): ScoreMatchResult {
  const emptyBreakdown: ScoreBreakdown = {
    basePoints: 0,
    exactScoreBonus: 0,
    marginBonus: 0,
    outcomeBonus: 0,
    fireBonus: 0,
    perfectDayBonus: 0,
    total: 0,
  };

  const empty: ScoreMatchResult = {
    points: 0,
    exactScore: false,
    correctResult: false,
    knockoutCorrect: false,
    outcomeBonus: 0,
    fireBonus: 0,
    breakdown: emptyBreakdown,
  };

  const allowLive = options?.allowLive === true;
  const scoreable =
    match.status === "final" || (allowLive && match.status === "live");

  if (
    !scoreable ||
    match.home_score === null ||
    match.away_score === null
  ) {
    return empty;
  }

  const actualHome = match.home_score;
  const actualAway = match.away_score;
  const predHome = prediction.pred_home_score;
  const predAway = prediction.pred_away_score;

  const exact = predHome === actualHome && predAway === actualAway;

  if (isKnockoutStage(match.stage)) {
    const actualWinner =
      match.winner_team_id ??
      (actualHome > actualAway
        ? match.home_team_id
        : actualAway > actualHome
          ? match.away_team_id
          : null);

    const knockoutCorrect =
      !!actualWinner && prediction.pred_winner_team_id === actualWinner;

    let points = 0;
    let outcomeBonus = 0;
    let basePoints = 0;
    let exactScoreBonus = 0;
    let fireBonus = 0;

    if (knockoutCorrect) {
      basePoints = getKnockoutAdvancePoints(match.stage);
      outcomeBonus = knockoutAdvanceBonus(match, actualWinner);
      points += basePoints + outcomeBonus;
    }

    if (exact) {
      exactScoreBonus = 3;
      points += exactScoreBonus;
      const bonusForFire = knockoutCorrect
        ? outcomeBonus
        : outcomeBonusForScoreline(
            match,
            predHome,
            predAway,
            prediction.pred_winner_team_id
          );
      fireBonus = calculateExactScoreFireBonus({
        isExactScore: true,
        isDraw: actualHome === actualAway,
        totalGoals: actualHome + actualAway,
        winningMargin: getMargin(actualHome, actualAway),
        outcomeBonus: bonusForFire,
        enabled: scoringConfig.exactScoreFireBonusEnabled,
      });
      points += fireBonus;
    }

    return {
      points,
      exactScore: exact,
      correctResult: knockoutCorrect,
      knockoutCorrect,
      outcomeBonus,
      fireBonus,
      breakdown: {
        basePoints,
        exactScoreBonus,
        marginBonus: 0,
        outcomeBonus,
        fireBonus,
        perfectDayBonus: 0,
        total: points,
      },
    };
  }

  const actualResult = getResult(actualHome, actualAway);
  const predResult = getResult(predHome, predAway);
  const correctResult = actualResult === predResult;

  if (!correctResult) {
    return empty;
  }

  const outcomeBonus = groupOutcomeBonus(match, actualResult);
  const basePoints = 3;
  let exactScoreBonus = 0;
  let marginBonus = 0;
  let fireBonus = 0;
  let points = basePoints + outcomeBonus;

  if (exact) {
    exactScoreBonus = 3;
    points += exactScoreBonus;
    fireBonus = calculateExactScoreFireBonus({
      isExactScore: true,
      isDraw: actualResult === "draw",
      totalGoals: actualHome + actualAway,
      winningMargin: getMargin(actualHome, actualAway),
      outcomeBonus,
      enabled: scoringConfig.exactScoreFireBonusEnabled,
    });
    points += fireBonus;
  } else if (actualResult !== "draw") {
    const actualMargin = getMargin(actualHome, actualAway);
    const predMargin = getMargin(predHome, predAway);
    if (actualMargin === predMargin) {
      marginBonus = 1;
      points += marginBonus;
    }
  }

  points = capGroupMatchPoints(points, scoringConfig);

  return {
    points,
    exactScore: exact,
    correctResult: true,
    knockoutCorrect: false,
    outcomeBonus,
    fireBonus,
    breakdown: {
      basePoints,
      exactScoreBonus,
      marginBonus,
      outcomeBonus,
      fireBonus,
      perfectDayBonus: 0,
      total: points,
    },
  };
}

export function calculatePerfectDayBonuses(
  matches: Match[],
  predictions: MatchPrediction[],
  playerIds: string[],
  scoringConfig: ScoringConfig = DEFAULT_SCORING_CONFIG
): Map<string, number> {
  const bonuses = new Map<string, number>();
  if (!scoringConfig.perfectDayBonusEnabled) return bonuses;

  const finalMatches = matches.filter((m) => m.status === "final");
  const byDate = new Map<string, Match[]>();
  for (const m of finalMatches) {
    if (!m.kickoff_at) continue;
    const date = m.kickoff_at.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(m);
    byDate.set(date, list);
  }

  const predByPlayerMatch = new Map<string, MatchPrediction>();
  for (const p of predictions) {
    if (isConfirmedPick(p)) {
      predByPlayerMatch.set(`${p.player_id}:${p.match_id}`, p);
    }
  }

  for (const playerId of playerIds) {
    for (const [, dayMatches] of byDate) {
      if (dayMatches.length < 2) continue;

      let allCorrect = true;
      let allPicked = true;

      for (const m of dayMatches) {
        const pred = predByPlayerMatch.get(`${playerId}:${m.id}`);
        const effective = getEffectiveMatchPrediction(m, pred);
        if (!effective) {
          allPicked = false;
          break;
        }
        const result = scoreMatchPrediction(m, effective, scoringConfig);
        if (!result.correctResult) {
          allCorrect = false;
          break;
        }
      }

      if (allPicked && allCorrect) {
        bonuses.set(
          playerId,
          (bonuses.get(playerId) ?? 0) + scoringConfig.perfectDayBonusPoints
        );
      }
    }
  }

  return bonuses;
}

export function calculateBigPredictionPoints(
  bigPrediction: Pick<
    BigPrediction,
    | "group_winners"
    | "group_runners_up"
    | "semifinalists"
    | "finalists"
    | "champion_team_id"
    | "top_scorer"
  >,
  actualResults: ActualTournamentResults,
  championProbabilities?: Record<string, number>
): number {
  let points = 0;

  for (const [group, teamId] of Object.entries(
    bigPrediction.group_winners ?? {}
  )) {
    if (actualResults.group_winners?.[group] === teamId) points += 2;
  }

  for (const [group, teamId] of Object.entries(
    bigPrediction.group_runners_up ?? {}
  )) {
    if (actualResults.group_runners_up?.[group] === teamId) points += 1;
  }

  for (const teamId of bigPrediction.semifinalists ?? []) {
    if (actualResults.semifinalists?.includes(teamId)) points += 8;
  }

  for (const teamId of bigPrediction.finalists ?? []) {
    if (actualResults.finalists?.includes(teamId)) points += 12;
  }

  if (
    bigPrediction.champion_team_id &&
    actualResults.champion === bigPrediction.champion_team_id
  ) {
    points += 25;
    const prob = championProbabilities?.[bigPrediction.champion_team_id];
    if (prob !== undefined && prob > 0) {
      points += championProbabilityToLongshotBonus(prob);
    }
  }

  if (
    bigPrediction.top_scorer &&
    actualResults.top_scorer &&
    bigPrediction.top_scorer.trim().toLowerCase() ===
      actualResults.top_scorer.trim().toLowerCase()
  ) {
    points += 10;
  }

  return points;
}

export function calculatePodiumPoints(
  podium: Pick<
    TournamentPodiumPrediction,
    "first_place_team_id" | "second_place_team_id" | "third_place_team_id"
  >,
  actualResults: ActualTournamentResults,
  championProbabilities?: Record<string, number>
): number {
  let points = 0;

  if (
    podium.first_place_team_id &&
    actualResults.champion === podium.first_place_team_id
  ) {
    points += 25;
    const prob = championProbabilities?.[podium.first_place_team_id];
    if (prob !== undefined && prob > 0) {
      points += championProbabilityToLongshotBonus(prob);
    }
  }

  if (
    podium.second_place_team_id &&
    actualResults.runner_up === podium.second_place_team_id
  ) {
    points += 15;
  }

  if (
    podium.third_place_team_id &&
    actualResults.third_place === podium.third_place_team_id
  ) {
    points += 10;
  }

  return points;
}

export function calculateFinalsChallengePoints(
  finalsPrediction: Pick<
    FinalsChallengePrediction,
    "quarterfinalists" | "semifinalists" | "finalists" | "champion_team_id"
  >,
  actualResults: ActualTournamentResults
): number {
  let points = 0;

  for (const teamId of finalsPrediction.quarterfinalists ?? []) {
    if (actualResults.quarterfinalists?.includes(teamId)) points += 4;
  }

  for (const teamId of finalsPrediction.semifinalists ?? []) {
    if (actualResults.semifinalists?.includes(teamId)) points += 6;
  }

  for (const teamId of finalsPrediction.finalists ?? []) {
    if (actualResults.finalists?.includes(teamId)) points += 10;
  }

  if (
    finalsPrediction.champion_team_id &&
    actualResults.champion === finalsPrediction.champion_team_id
  ) {
    points += 15;
  }

  return points;
}

function compareTieBreakers(
  a: LeaderboardEntry,
  b: LeaderboardEntry
): number {
  if (b.exactScores !== a.exactScores)
    return b.exactScores - a.exactScores;
  if (b.correctResults !== a.correctResults)
    return b.correctResults - a.correctResults;
  if (b.knockoutCorrect !== a.knockoutCorrect)
    return b.knockoutCorrect - a.knockoutCorrect;
  if (b.beforeCupPoints !== a.beforeCupPoints)
    return b.beforeCupPoints - a.beforeCupPoints;

  const aDiff = a.closestFinalScoreDiff ?? Infinity;
  const bDiff = b.closestFinalScoreDiff ?? Infinity;
  if (aDiff !== bDiff) return aDiff - bDiff;

  return 0;
}

export function calculateLeaderboard(
  players: Player[],
  matches: Match[],
  predictions: MatchPrediction[],
  podiumPredictions: TournamentPodiumPrediction[],
  finalsPredictions: FinalsChallengePrediction[],
  adjustments: ManualAdjustment[],
  settings: Settings,
  actualResults: ActualTournamentResults,
  projectedPrizes: Map<string, number>,
  options?: { includeLiveScores?: boolean }
): LeaderboardEntry[] {
  const includeLiveScores = options?.includeLiveScores ?? false;
  const finalMatch = matches.find((m) => m.stage === "final");
  const scoringConfig = scoringConfigFromSettings(settings);
  const confirmedPredictions = predictions.filter(isConfirmedPick);
  const perfectDayBonuses = calculatePerfectDayBonuses(
    matches,
    confirmedPredictions,
    players.map((p) => p.id),
    scoringConfig
  );

  const podiumByPlayer = new Map(
    podiumPredictions.map((p) => [p.player_id, p])
  );
  const finalsByPlayer = new Map(
    finalsPredictions.map((f) => [f.player_id, f])
  );
  const adjByPlayer = new Map<string, number>();
  for (const a of adjustments) {
    adjByPlayer.set(
      a.player_id,
      (adjByPlayer.get(a.player_id) ?? 0) + a.points
    );
  }

  const entries: LeaderboardEntry[] = players.map((player) => {
    const playerPreds = confirmedPredictions.filter(
      (p) => p.player_id === player.id
    );
    const predByMatchId = new Map(playerPreds.map((p) => [p.match_id, p]));
    let matchPoints = 0;
    let groupStagePoints = 0;
    let knockoutPoints = 0;
    let hardPickBonusPoints = 0;
    let fireBonusPoints = 0;
    let exactScores = 0;
    let correctResults = 0;
    let knockoutCorrect = 0;

    let livePoints = 0;

    for (const match of matches) {
      const pred = predByMatchId.get(match.id);
      const effective = getEffectiveMatchPrediction(match, pred);
      if (!effective) continue;

      if (match.status === "final") {
        const result = scoreMatchPrediction(match, effective, scoringConfig);
        matchPoints += result.points;
        if (match.stage === "group") {
          groupStagePoints += result.points;
        } else if (isKnockoutStage(match.stage)) {
          knockoutPoints += result.points;
        }
        hardPickBonusPoints += result.outcomeBonus;
        fireBonusPoints += result.fireBonus;
        if (result.exactScore) exactScores++;
        if (result.correctResult) correctResults++;
        if (result.knockoutCorrect) knockoutCorrect++;
      } else if (includeLiveScores && match.status === "live") {
        const result = scoreMatchPrediction(match, effective, scoringConfig, {
          allowLive: true,
        });
        livePoints += result.points;
      }
    }

    const podiumPred = podiumByPlayer.get(player.id);
    const beforeCupPoints = podiumPred
      ? calculatePodiumPoints(
          podiumPred,
          actualResults,
          settings.champion_probabilities
        )
      : 0;

    const finalsPred = finalsByPlayer.get(player.id);
    const finalsChallengePoints = finalsPred
      ? calculateFinalsChallengePoints(finalsPred, actualResults)
      : 0;

    const perfectDayBonus = perfectDayBonuses.get(player.id) ?? 0;
    const manualAdjustments = adjByPlayer.get(player.id) ?? 0;

    const totalPoints =
      matchPoints + beforeCupPoints + perfectDayBonus + manualAdjustments;
    const provisionalTotalPoints = totalPoints + livePoints;

    let closestFinalScoreDiff: number | null = null;
    if (finalMatch?.status === "final" && finalMatch.home_score !== null) {
      const finalPred = getEffectiveMatchPrediction(
        finalMatch,
        predByMatchId.get(finalMatch.id)
      );
      if (finalPred) {
        closestFinalScoreDiff =
          Math.abs(finalPred.pred_home_score - finalMatch.home_score!) +
          Math.abs(finalPred.pred_away_score - finalMatch.away_score!);
      }
    }

    return {
      playerId: player.id,
      displayName: player.display_name,
      avatarEmoji: player.avatar_emoji,
      paid: player.paid,
      isAdmin: player.is_admin,
      totalPoints,
      matchPoints,
      groupStagePoints,
      knockoutPoints,
      hardPickBonusPoints,
      fireBonusPoints,
      miraclePoints: hardPickBonusPoints + fireBonusPoints,
      bigPickPoints: beforeCupPoints,
      perfectDayBonus,
      manualAdjustments,
      exactScores,
      correctResults,
      knockoutCorrect,
      picksMade: matches.filter((m) =>
        getEffectiveMatchPrediction(m, predByMatchId.get(m.id))
      ).length,
      beforeCupPoints,
      finalsChallengePoints,
      rank: 0,
      projectedPrize: projectedPrizes.get(player.id) ?? 0,
      prizeLabel: settings.tournament_complete ? "Won" : "Projected",
      closestFinalScoreDiff,
      livePoints: includeLiveScores ? livePoints : undefined,
      provisionalTotalPoints:
        includeLiveScores && livePoints > 0 ? provisionalTotalPoints : undefined,
    };
  });

  const sortPoints = (entry: LeaderboardEntry) =>
    includeLiveScores && entry.provisionalTotalPoints != null
      ? entry.provisionalTotalPoints
      : entry.totalPoints;

  entries.sort((a, b) => {
    const aPts = sortPoints(a);
    const bPts = sortPoints(b);
    if (bPts !== aPts) return bPts - aPts;
    return compareTieBreakers(a, b);
  });

  entries.forEach((e, i) => {
    e.rank = i + 1;
  });

  return entries;
}

export function getFinalsChallengeLeaderboard(
  players: Player[],
  finalsPredictions: FinalsChallengePrediction[],
  actualResults: ActualTournamentResults
): Array<{
  playerId: string;
  displayName: string;
  avatarEmoji: string;
  points: number;
  rank: number;
}> {
  const rows = players.map((player) => {
    const pred = finalsPredictions.find((f) => f.player_id === player.id);
    const points = pred
      ? calculateFinalsChallengePoints(pred, actualResults)
      : 0;
    return {
      playerId: player.id,
      displayName: player.display_name,
      avatarEmoji: player.avatar_emoji,
      points,
      rank: 0,
      championCorrect:
        pred?.champion_team_id === actualResults.champion,
      finalistsCorrect: (pred?.finalists ?? []).filter((t) =>
        actualResults.finalists?.includes(t)
      ).length,
      semifinalistsCorrect: (pred?.semifinalists ?? []).filter((t) =>
        actualResults.semifinalists?.includes(t)
      ).length,
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.championCorrect !== a.championCorrect)
      return (b.championCorrect ? 1 : 0) - (a.championCorrect ? 1 : 0);
    if (b.finalistsCorrect !== a.finalistsCorrect)
      return b.finalistsCorrect - a.finalistsCorrect;
    if (b.semifinalistsCorrect !== a.semifinalistsCorrect)
      return b.semifinalistsCorrect - a.semifinalistsCorrect;
    return 0;
  });

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function countPerfectDays(
  matches: Match[],
  predictions: MatchPrediction[],
  playerId: string,
  scoringConfig: ScoringConfig = DEFAULT_SCORING_CONFIG
): number {
  if (!scoringConfig.perfectDayBonusEnabled) return 0;

  const finalMatches = matches.filter((m) => m.status === "final");
  const byDate = new Map<string, Match[]>();
  for (const m of finalMatches) {
    if (!m.kickoff_at) continue;
    const date = m.kickoff_at.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(m);
    byDate.set(date, list);
  }

  let count = 0;
  for (const [, dayMatches] of byDate) {
    if (dayMatches.length < 2) continue;
    let allCorrect = true;
    let allPicked = true;
    for (const m of dayMatches) {
      const pred = predictions.find(
        (p) => p.player_id === playerId && p.match_id === m.id
      );
      if (!pred) {
        allPicked = false;
        break;
      }
      const result = scoreMatchPrediction(m, pred, scoringConfig);
      if (!result.correctResult) {
        allCorrect = false;
        break;
      }
    }
    if (allPicked && allCorrect) count++;
  }
  return count;
}
