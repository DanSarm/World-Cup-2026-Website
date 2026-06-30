import { parseISO } from "date-fns";
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
  Team,
  TournamentPodiumPrediction,
} from "./types";
import { isKnockoutStage } from "./types";
import { assignCompetitionRanks } from "./competitionRank";
import { hasDisplayableLiveScore, isMatchDecidedForScoring } from "./matchLive";
import { isConfirmedPick, getEffectiveMatchPrediction } from "./pickUtils";
import { calculateExactScoreFireBonus } from "./fireBonus";
import {
  capGroupMatchPoints,
  previewPickRewards,
  resolvePredictedKnockoutWinner,
  scoringConfigFromSettings,
  type ScoringConfig,
  DEFAULT_SCORING_CONFIG,
} from "./scoringConfig";
import {
  EXACT_SCORE_BONUS,
  scoreError,
} from "./scoreCloseness";
import { resolveGroupOutcomeBonuses, championProbabilityToLongshotBonus } from "./odds/math";
import {
  calculateTeamTournamentValue,
  tournamentPlacePoints,
} from "./tournamentValue";
import { matchDateKey } from "./utils";

/** Knockout match decided on penalties (explicit flag or tied score + advancer). */
function isKnockoutPenaltyDecided(
  match: Pick<
    Match,
    | "stage"
    | "home_score"
    | "away_score"
    | "winner_team_id"
    | "decided_by_penalties"
  >
): boolean {
  if (!isKnockoutStage(match.stage)) return false;
  if (match.decided_by_penalties) return true;
  return (
    match.home_score !== null &&
    match.away_score !== null &&
    match.home_score === match.away_score &&
    match.winner_team_id != null
  );
}

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

/** Picked score equals the final score (pool "exact" stat). */
export function isScorelineMatch(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): boolean {
  return predHome === actualHome && predAway === actualAway;
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
  outcomeBonus: number;
  fireBonus: number;
  total: number;
}

export { DEFAULT_SCORING_CONFIG, scoringConfigFromSettings };
export type { ScoringConfig };

function groupOutcomeBonus(
  match: Pick<
    Match,
    | "home_win_bonus"
    | "draw_bonus"
    | "away_win_bonus"
    | "home_implied_probability"
    | "draw_implied_probability"
    | "away_implied_probability"
  >,
  actualResult: "home" | "away" | "draw"
): number {
  const bonuses = resolveGroupOutcomeBonuses(match);
  if (actualResult === "home") return bonuses.home;
  if (actualResult === "draw") return bonuses.draw;
  return bonuses.away;
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
    | "kickoff_at"
    | "home_win_bonus"
    | "draw_bonus"
    | "away_win_bonus"
    | "home_implied_probability"
    | "draw_implied_probability"
    | "away_implied_probability"
    | "home_advance_bonus"
    | "away_advance_bonus"
    | "decided_by_penalties"
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
    outcomeBonus: 0,
    fireBonus: 0,
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
    isMatchDecidedForScoring(match) ||
    (allowLive && hasDisplayableLiveScore(match));

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
  const error = scoreError(predHome, predAway, actualHome, actualAway);

  if (isKnockoutStage(match.stage)) {
    const actualWinner =
      match.winner_team_id ??
      (actualHome > actualAway
        ? match.home_team_id
        : actualAway > actualHome
          ? match.away_team_id
          : null);

    const predictedWinner = resolvePredictedKnockoutWinner(
      match,
      predHome,
      predAway,
      prediction.pred_winner_team_id
    );

    if (!actualWinner || predictedWinner !== actualWinner) {
      return empty;
    }

    const penaltyDecided = isKnockoutPenaltyDecided(match);
    const predictedTie = predHome === predAway;

    if (penaltyDecided) {
      if (predictedTie) {
        // Tie pick: exact scoreline required for any points after pens.
        if (error !== 0) return empty;
      } else {
        // Non-tie pick: correct advancer after pens earns base only.
        const basePoints = getKnockoutAdvancePoints(match.stage);
        const outcomeBonus = knockoutAdvanceBonus(match, actualWinner);
        const points = basePoints + outcomeBonus;
        return {
          points,
          exactScore: false,
          correctResult: true,
          knockoutCorrect: true,
          outcomeBonus,
          fireBonus: 0,
          breakdown: {
            basePoints,
            exactScoreBonus: 0,
            outcomeBonus,
            fireBonus: 0,
            total: points,
          },
        };
      }
    }

    const basePoints = getKnockoutAdvancePoints(match.stage);
    const outcomeBonus = knockoutAdvanceBonus(match, actualWinner);
    let exactScoreBonus = 0;
    let fireBonus = 0;
    let points = basePoints + outcomeBonus;

    if (error === 0) {
      exactScoreBonus = EXACT_SCORE_BONUS;
      points += exactScoreBonus;
      fireBonus = calculateExactScoreFireBonus({
        isExactScore: true,
        isDraw: actualHome === actualAway,
        totalGoals: actualHome + actualAway,
        winningMargin: getMargin(actualHome, actualAway),
        outcomeBonus,
        enabled: scoringConfig.exactScoreFireBonusEnabled,
      });
      points += fireBonus;
    }

    return {
      points,
      exactScore: error === 0,
      correctResult: true,
      knockoutCorrect: true,
      outcomeBonus,
      fireBonus,
      breakdown: {
        basePoints,
        exactScoreBonus,
        outcomeBonus,
        fireBonus,
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
  let fireBonus = 0;
  let points = basePoints + outcomeBonus;

  if (error === 0) {
    exactScoreBonus = EXACT_SCORE_BONUS;
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
      outcomeBonus,
      fireBonus,
      total: points,
    },
  };
}

function groupFinalizedMatchesByDisplayDate(matches: Match[]): Map<string, Match[]> {
  const byDate = new Map<string, Match[]>();
  for (const m of matches) {
    if (!isMatchDecidedForScoring(m)) continue;
    const date = matchDateKey(m.kickoff_at);
    if (!date || date === "tba") continue;
    const list = byDate.get(date) ?? [];
    list.push(m);
    byDate.set(date, list);
  }
  return byDate;
}

function buildConfirmedPredictionIndex(
  predictions: MatchPrediction[]
): Map<string, MatchPrediction> {
  const predByPlayerMatch = new Map<string, MatchPrediction>();
  for (const p of predictions) {
    if (isConfirmedPick(p)) {
      predByPlayerMatch.set(`${p.player_id}:${p.match_id}`, p);
    }
  }
  return predByPlayerMatch;
}

function wasPickSubmittedBeforeKickoff(
  pred: MatchPrediction,
  match: Pick<Match, "kickoff_at">
): boolean {
  if (!match.kickoff_at) return true;
  const submittedAt = pred.submitted_at ?? pred.updated_at;
  if (!submittedAt) return true;
  return parseISO(submittedAt).getTime() <= parseISO(match.kickoff_at).getTime();
}

function isPerfectDayForPlayer(
  playerId: string,
  dayMatches: Match[],
  predByPlayerMatch: Map<string, MatchPrediction>,
  scoringConfig: ScoringConfig
): boolean {
  if (dayMatches.length < 2) return false;

  for (const m of dayMatches) {
    const pred = predByPlayerMatch.get(`${playerId}:${m.id}`);
    if (!pred || !isConfirmedPick(pred)) return false;
    if (!wasPickSubmittedBeforeKickoff(pred, m)) return false;
    const result = scoreMatchPrediction(m, pred, scoringConfig);
    if (!result.correctResult) return false;
  }

  return true;
}

/** Perfect Day counts per player — stat/highlight only, awards 0 points. */
export function calculatePerfectDayCounts(
  matches: Match[],
  predictions: MatchPrediction[],
  playerIds: string[],
  scoringConfig: ScoringConfig = DEFAULT_SCORING_CONFIG
): Map<string, number> {
  const counts = new Map<string, number>();
  const byDate = groupFinalizedMatchesByDisplayDate(matches);
  const predByPlayerMatch = buildConfirmedPredictionIndex(predictions);

  for (const playerId of playerIds) {
    let count = 0;
    for (const [, dayMatches] of byDate) {
      if (
        isPerfectDayForPlayer(
          playerId,
          dayMatches,
          predByPlayerMatch,
          scoringConfig
        )
      ) {
        count++;
      }
    }
    if (count > 0) counts.set(playerId, count);
  }

  return counts;
}

/** @deprecated Perfect Day no longer awards points — always returns an empty map. */
export function calculatePerfectDayBonuses(
  matches: Match[],
  predictions: MatchPrediction[],
  playerIds: string[],
  _scoringConfig: ScoringConfig = DEFAULT_SCORING_CONFIG
): Map<string, number> {
  void matches;
  void predictions;
  void playerIds;
  return new Map();
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

export interface TournamentPickPointsBreakdown {
  total: number;
  champion: number;
  runnerUp: number;
  thirdPlace: number;
}

type PodiumPickSlot = "champion" | "runnerUp" | "thirdPlace";
type ActualPodiumFinish = "champion" | "runnerUp" | "thirdPlace";

const PODIUM_PARTIAL_CREDIT: Record<
  PodiumPickSlot,
  Record<ActualPodiumFinish, number>
> = {
  champion: { champion: 1, runnerUp: 0.35, thirdPlace: 0.2 },
  runnerUp: { champion: 0.25, runnerUp: 0.45, thirdPlace: 0.2 },
  thirdPlace: { champion: 0.15, runnerUp: 0.15, thirdPlace: 0.3 },
};

function podiumSlotPoints(
  pickedTeamId: string | null,
  slot: PodiumPickSlot,
  actualResults: ActualTournamentResults,
  teamsById: Map<string, Team>
): number {
  if (!pickedTeamId) return 0;
  const value = calculateTeamTournamentValue(teamsById.get(pickedTeamId));
  if (value <= 0) return 0;

  const credits = PODIUM_PARTIAL_CREDIT[slot];
  if (actualResults.champion === pickedTeamId) {
    return Math.round(value * credits.champion);
  }
  if (actualResults.runner_up === pickedTeamId) {
    return Math.round(value * credits.runnerUp);
  }
  if (actualResults.third_place === pickedTeamId) {
    return Math.round(value * credits.thirdPlace);
  }
  return 0;
}

/**
 * Tournament Picks scoring: market-based team value with podium partial credit.
 */
export function calculatePodiumPoints(
  podium: Pick<
    TournamentPodiumPrediction,
    "first_place_team_id" | "second_place_team_id" | "third_place_team_id"
  >,
  actualResults: ActualTournamentResults,
  teamsById: Map<string, Team>
): TournamentPickPointsBreakdown {
  const champion = podiumSlotPoints(
    podium.first_place_team_id,
    "champion",
    actualResults,
    teamsById
  );
  const runnerUp = podiumSlotPoints(
    podium.second_place_team_id,
    "runnerUp",
    actualResults,
    teamsById
  );
  const thirdPlace = podiumSlotPoints(
    podium.third_place_team_id,
    "thirdPlace",
    actualResults,
    teamsById
  );

  return {
    total: champion + runnerUp + thirdPlace,
    champion,
    runnerUp,
    thirdPlace,
  };
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
  teams: Team[] = [],
  options?: { includeLiveScores?: boolean }
): LeaderboardEntry[] {
  const includeLiveScores = options?.includeLiveScores ?? false;
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const finalMatch = matches.find((m) => m.stage === "final");
  const scoringConfig = scoringConfigFromSettings(settings);
  const confirmedPredictions = predictions.filter(isConfirmedPick);
  const perfectDayCounts = calculatePerfectDayCounts(
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

  // Tie-breaker only (never displayed): max points a player could still
  // earn from picks on undecided matches and podium positions.
  const potentialByPlayer = new Map<string, number>();

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
    let potentialPoints = 0;

    for (const match of matches) {
      const pred = predByMatchId.get(match.id);
      const effective = getEffectiveMatchPrediction(match, pred);
      if (!effective) continue;

      if (!isMatchDecidedForScoring(match)) {
        potentialPoints += previewPickRewards(
          match,
          effective.pred_home_score,
          effective.pred_away_score,
          scoringConfig,
          effective.pred_winner_team_id
        ).maxPoints;
      }

      if (isMatchDecidedForScoring(match)) {
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
      } else if (includeLiveScores && hasDisplayableLiveScore(match)) {
        const result = scoreMatchPrediction(match, effective, scoringConfig, {
          allowLive: true,
        });
        livePoints += result.points;
      }
    }

    const podiumPred = podiumByPlayer.get(player.id);
    const tournamentPicks = podiumPred
      ? calculatePodiumPoints(podiumPred, actualResults, teamsById)
      : { total: 0, champion: 0, runnerUp: 0, thirdPlace: 0 };
    const beforeCupPoints = tournamentPicks.total;

    if (podiumPred) {
      if (!actualResults.champion && podiumPred.first_place_team_id) {
        potentialPoints += tournamentPlacePoints(
          teamsById.get(podiumPred.first_place_team_id),
          "champion"
        );
      }
      if (!actualResults.runner_up && podiumPred.second_place_team_id) {
        potentialPoints += tournamentPlacePoints(
          teamsById.get(podiumPred.second_place_team_id),
          "runnerUp"
        );
      }
      if (!actualResults.third_place && podiumPred.third_place_team_id) {
        potentialPoints += tournamentPlacePoints(
          teamsById.get(podiumPred.third_place_team_id),
          "thirdPlace"
        );
      }
    }
    potentialByPlayer.set(player.id, potentialPoints);

    const finalsPred = finalsByPlayer.get(player.id);
    const finalsChallengePoints = finalsPred
      ? calculateFinalsChallengePoints(finalsPred, actualResults)
      : 0;

    const manualAdjustments = adjByPlayer.get(player.id) ?? 0;
    const perfectDaysCount = perfectDayCounts.get(player.id) ?? 0;

    const totalPoints =
      matchPoints + beforeCupPoints + manualAdjustments;
    const provisionalTotalPoints = totalPoints + livePoints;

    let closestFinalScoreDiff: number | null = null;
    if (finalMatch && isMatchDecidedForScoring(finalMatch) && finalMatch.home_score !== null) {
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
      perfectDaysCount,
      manualAdjustments,
      exactScores,
      correctResults,
      knockoutCorrect,
      picksMade: matches.filter((m) =>
        getEffectiveMatchPrediction(m, predByMatchId.get(m.id))
      ).length,
      beforeCupPoints,
      tournamentPickPoints: tournamentPicks.total,
      championPickPoints: tournamentPicks.champion,
      runnerUpPickPoints: tournamentPicks.runnerUp,
      thirdPlacePickPoints: tournamentPicks.thirdPlace,
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
    const aPotential = potentialByPlayer.get(a.playerId) ?? 0;
    const bPotential = potentialByPlayer.get(b.playerId) ?? 0;
    if (bPotential !== aPotential) return bPotential - aPotential;
    return compareTieBreakers(a, b);
  });

  assignCompetitionRanks(entries, sortPoints);

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

  assignCompetitionRanks(rows, (r) => r.points);

  return rows;
}

export function countPerfectDays(
  matches: Match[],
  predictions: MatchPrediction[],
  playerId: string,
  scoringConfig: ScoringConfig = DEFAULT_SCORING_CONFIG
): number {
  return (
    calculatePerfectDayCounts(matches, predictions, [playerId], scoringConfig).get(
      playerId
    ) ?? 0
  );
}
