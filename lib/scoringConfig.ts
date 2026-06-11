import type { Match } from "./types";
import { isKnockoutStage } from "./types";
import { calculateExactScoreFireBonus } from "./fireBonus";
import { pickPreviewLabel } from "./fireBonus";
import { EXACT_SCORE_BONUS } from "./scoreCloseness";

export interface ScoringConfig {
  exactScoreFireBonusEnabled: boolean;
  groupStageMatchPointCap: number;
  perfectDayBonusEnabled: boolean;
  perfectDayBonusPoints: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  exactScoreFireBonusEnabled: true,
  groupStageMatchPointCap: 18,
  perfectDayBonusEnabled: true,
  perfectDayBonusPoints: 5,
};

/** Accept legacy and new settings keys. */
export function scoringConfigFromSettings(settings: {
  exact_score_fire_bonus_enabled?: boolean;
  crazy_scoreline_bonus_enabled?: boolean;
  group_stage_match_point_cap?: number;
  max_group_match_points?: number;
  perfect_day_bonus_enabled?: boolean;
  perfect_day_bonus_points?: number;
}): ScoringConfig {
  return {
    exactScoreFireBonusEnabled:
      settings.exact_score_fire_bonus_enabled ??
      settings.crazy_scoreline_bonus_enabled ??
      true,
    groupStageMatchPointCap:
      settings.group_stage_match_point_cap ??
      settings.max_group_match_points ??
      18,
    perfectDayBonusEnabled: settings.perfect_day_bonus_enabled ?? true,
    perfectDayBonusPoints: settings.perfect_day_bonus_points ?? 5,
  };
}

function getResult(
  homeScore: number,
  awayScore: number
): "home" | "away" | "draw" {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

export function outcomeBonusForScoreline(
  match: Pick<
    Match,
    | "stage"
    | "home_win_bonus"
    | "draw_bonus"
    | "away_win_bonus"
    | "home_advance_bonus"
    | "away_advance_bonus"
    | "home_team_id"
    | "away_team_id"
  >,
  homeScore: number,
  awayScore: number,
  winnerTeamId?: string | null
): number {
  if (isKnockoutStage(match.stage)) {
    if (homeScore === awayScore) {
      if (winnerTeamId === match.home_team_id) return match.home_advance_bonus ?? 0;
      if (winnerTeamId === match.away_team_id) return match.away_advance_bonus ?? 0;
      return 0;
    }
    const result = getResult(homeScore, awayScore);
    if (result === "home") return match.home_advance_bonus ?? 0;
    return match.away_advance_bonus ?? 0;
  }

  const result = getResult(homeScore, awayScore);
  if (result === "home") return match.home_win_bonus ?? 0;
  if (result === "draw") return match.draw_bonus ?? 0;
  return match.away_win_bonus ?? 0;
}

export function capGroupMatchPoints(
  points: number,
  config: ScoringConfig
): number {
  return Math.min(points, config.groupStageMatchPointCap);
}

export interface PickRewardPreview {
  maxPoints: number;
  outcomeBonus: number;
  fireBonus: number;
  exactScoreBonus: number;
  resultOnlyPoints: number;
  label: string;
}

function knockoutRoundBase(stage: Match["stage"]): number {
  const map: Partial<Record<Match["stage"], number>> = {
    round_of_32: 4,
    round_of_16: 5,
    quarterfinal: 6,
    semifinal: 8,
    third_place: 5,
    final: 10,
  };
  return map[stage] ?? 4;
}

export function previewPickRewards(
  match: Match,
  predHome: number,
  predAway: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  predWinnerTeamId?: string | null
): PickRewardPreview {
  if (isKnockoutStage(match.stage)) {
    const winnerId =
      predWinnerTeamId ??
      (predHome > predAway
        ? match.home_team_id
        : predAway > predHome
          ? match.away_team_id
          : null);
    const advanceBonus = outcomeBonusForScoreline(
      match,
      predHome,
      predAway,
      winnerId
    );
    const roundBase = knockoutRoundBase(match.stage);
    const fireBonus = calculateExactScoreFireBonus({
      isExactScore: true,
      isDraw: predHome === predAway,
      totalGoals: predHome + predAway,
      winningMargin: Math.abs(predHome - predAway),
      outcomeBonus: advanceBonus,
      enabled: config.exactScoreFireBonusEnabled,
    });
    const maxPoints = roundBase + advanceBonus + EXACT_SCORE_BONUS + fireBonus;
    return {
      maxPoints,
      outcomeBonus: advanceBonus,
      fireBonus,
      exactScoreBonus: EXACT_SCORE_BONUS,
      resultOnlyPoints: roundBase + advanceBonus,
      label: pickPreviewLabel(maxPoints),
    };
  }

  const outcomeBonus = outcomeBonusForScoreline(match, predHome, predAway);
  const resultOnlyPoints = 3 + outcomeBonus;
  const fireBonus = calculateExactScoreFireBonus({
    isExactScore: true,
    isDraw: predHome === predAway,
    totalGoals: predHome + predAway,
    winningMargin: Math.abs(predHome - predAway),
    outcomeBonus,
    enabled: config.exactScoreFireBonusEnabled,
  });
  const maxPoints = capGroupMatchPoints(
    resultOnlyPoints + EXACT_SCORE_BONUS + fireBonus,
    config
  );

  return {
    maxPoints,
    outcomeBonus,
    fireBonus,
    exactScoreBonus: EXACT_SCORE_BONUS,
    resultOnlyPoints,
    label: pickPreviewLabel(maxPoints),
  };
}

export function maxPossibleMatchPoints(
  match: Pick<
    Match,
    | "stage"
    | "home_win_bonus"
    | "draw_bonus"
    | "away_win_bonus"
    | "home_advance_bonus"
    | "away_advance_bonus"
  >,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): number {
  if (match.stage === "group") {
    const maxOutcome = Math.max(
      match.home_win_bonus ?? 0,
      match.draw_bonus ?? 0,
      match.away_win_bonus ?? 0
    );
    const raw =
      3 +
      EXACT_SCORE_BONUS +
      maxOutcome +
      (config.exactScoreFireBonusEnabled ? 4 : 0);
    return capGroupMatchPoints(raw, config);
  }

  const stagePts = knockoutRoundBase(match.stage as Match["stage"]);
  const maxAdvance = Math.max(
    match.home_advance_bonus ?? 0,
    match.away_advance_bonus ?? 0
  );
  return (
    stagePts +
    EXACT_SCORE_BONUS +
    maxAdvance +
    (config.exactScoreFireBonusEnabled ? 4 : 0)
  );
}
