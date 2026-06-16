import {
  DEFAULT_SCORING_CONFIG,
  maxPossibleMatchPoints,
  type ScoringConfig,
} from "./scoringConfig";

export type { ScoringConfig };
export { DEFAULT_SCORING_CONFIG };

export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "final";

export type MatchStatus = "scheduled" | "locked" | "live" | "final";

export type OddsStatus =
  | "not_synced"
  | "synced"
  | "locked"
  | "failed"
  | "manual";

export type OddsOutcomeType =
  | "home"
  | "draw"
  | "away"
  | "home_advance"
  | "away_advance";

export interface OddsSnapshot {
  id: string;
  match_id: string;
  provider: string;
  source_event_id: string | null;
  bookmaker_key: string | null;
  bookmaker_title: string | null;
  market_key: string;
  outcome_name: string;
  outcome_type: OddsOutcomeType;
  decimal_price: number | null;
  american_price: number | null;
  raw_implied_probability: number | null;
  normalized_probability: number | null;
  fetched_at?: string;
}

export interface Team {
  id: string;
  name: string;
  short_name: string;
  fifa_code: string;
  flag_emoji: string;
  group_letter: string | null;
  /** Pre-tournament market win % (e.g. 14 = 14%) */
  market_win_percentage?: number | null;
  market_rank?: number | null;
  /** Display label, e.g. "<1%" — calculations still use the stored % */
  market_label?: string | null;
  /** Admin override for the computed tournament value */
  tournament_value_override?: number | null;
  created_at?: string;
}

export interface Player {
  id: string;
  display_name: string;
  pin_hash: string;
  favorite_team_id: string | null;
  avatar_emoji: string;
  is_admin: boolean;
  paid: boolean;
  paid_amount: number;
  created_at?: string;
  last_login_at?: string | null;
}

export interface Match {
  id: string;
  match_number: number;
  stage: MatchStage;
  group_letter: string | null;
  kickoff_at: string | null;
  venue: string | null;
  city: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_label: string;
  away_label: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
  live_updated_at?: string | null;
  /** Ephemeral — from ESPN on last live sync, not stored in DB. */
  live_clock_display?: string | null;
  decided_by_penalties: boolean;
  home_win_bonus: number;
  draw_bonus: number;
  away_win_bonus: number;
  home_advance_bonus: number;
  away_advance_bonus: number;
  odds_event_id: string | null;
  odds_last_synced_at: string | null;
  odds_locked_at: string | null;
  odds_status: OddsStatus;
  home_implied_probability: number | null;
  draw_implied_probability: number | null;
  away_implied_probability: number | null;
  home_advance_probability: number | null;
  away_advance_probability: number | null;
  odds_source_note: string | null;
  /** @deprecated use odds_source_note */
  odds_source?: string | null;
  /** @deprecated use odds_last_synced_at */
  odds_checked_at?: string | null;
  created_at?: string;
  updated_at?: string;
  home_team?: Team | null;
  away_team?: Team | null;
}

export interface MatchPrediction {
  id: string;
  player_id: string;
  match_id: string;
  pred_home_score: number;
  pred_away_score: number;
  pred_winner_team_id: string | null;
  pick_confirmed?: boolean;
  points: number;
  exact_score: boolean;
  correct_result: boolean;
  submitted_at?: string;
  updated_at?: string;
}

export interface TournamentPodiumPrediction {
  id: string;
  player_id: string;
  first_place_team_id: string | null;
  second_place_team_id: string | null;
  third_place_team_id: string | null;
  podium_confirmed?: boolean;
  points: number;
  champion_points?: number;
  runner_up_points?: number;
  third_place_points?: number;
  submitted_at?: string;
  updated_at?: string;
}

export type PodiumTeamRef = Pick<Team, "fifa_code" | "short_name" | "name">;

export type PickFormFinalResult = "exact" | "correct" | "wrong" | "missed";
export type PickFormLiveResult =
  | "live-exact"
  | "live-correct"
  | "live-wrong"
  | "live-pending";
export type PickFormResult = PickFormFinalResult | PickFormLiveResult;
export type PickFormSlot = PickFormResult | null;

export interface CommunityMatchPick {
  playerId: string;
  displayName: string;
  avatarEmoji: string;
  predHomeScore: number;
  predAwayScore: number;
  predWinnerTeamId: string | null;
  podiumPicks?: PlayerPodiumDisplay | null;
  recentForm?: PickFormSlot[];
}

export interface PlayerPodiumDisplay {
  first: PodiumTeamRef | null;
  second: PodiumTeamRef | null;
  third: PodiumTeamRef | null;
}

export interface BigPrediction {
  id: string;
  player_id: string;
  group_winners: Record<string, string>;
  group_runners_up: Record<string, string>;
  semifinalists: string[];
  finalists: string[];
  champion_team_id: string | null;
  top_scorer: string | null;
  points: number;
  submitted_at?: string;
  updated_at?: string;
}

export interface FinalsChallengePrediction {
  id: string;
  player_id: string;
  quarterfinalists: string[];
  semifinalists: string[];
  finalists: string[];
  champion_team_id: string | null;
  points: number;
  submitted_at?: string;
  updated_at?: string;
}

export interface ManualAdjustment {
  id: string;
  player_id: string;
  points: number;
  reason: string;
  created_by: string | null;
  created_at?: string;
}

export interface PayoutPercentages {
  overall_first: number;
  overall_second: number;
  overall_third: number;
  exact_score: number;
  finals_challenge: number;
  fun_prize: number;
}

export interface Settings {
  buy_in: number;
  pool_locked: boolean;
  big_predictions_locked: boolean;
  finals_challenge_open: boolean;
  tournament_complete: boolean;
  payout_percentages: PayoutPercentages;
  exact_score_fire_bonus_enabled: boolean;
  group_stage_match_point_cap: number;
  perfect_day_bonus_enabled: boolean;
  perfect_day_bonus_points: number;
  odds_lock_hours_before_kickoff: number;
  champion_probabilities?: Record<string, number>;
  /** @deprecated use exact_score_fire_bonus_enabled */
  crazy_scoreline_bonus_enabled?: boolean;
  /** @deprecated use group_stage_match_point_cap */
  max_group_match_points?: number;
  fun_prize_winner_id?: string | null;
}

export interface ActualTournamentResults {
  group_winners?: Record<string, string>;
  group_runners_up?: Record<string, string>;
  semifinalists?: string[];
  finalists?: string[];
  champion?: string;
  runner_up?: string;
  third_place?: string;
  top_scorer?: string;
  quarterfinalists?: string[];
  team_rounds_reached?: Record<string, string>;
}

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  avatarEmoji: string;
  paid: boolean;
  isAdmin: boolean;
  totalPoints: number;
  matchPoints: number;
  groupStagePoints: number;
  knockoutPoints: number;
  hardPickBonusPoints: number;
  fireBonusPoints: number;
  miraclePoints: number;
  bigPickPoints: number;
  /** Fun stat only — no longer adds to total points */
  perfectDaysCount: number;
  manualAdjustments: number;
  exactScores: number;
  correctResults: number;
  knockoutCorrect: number;
  picksMade: number;
  beforeCupPoints: number;
  /** Total Tournament Picks points (champion + runner-up + third place) */
  tournamentPickPoints: number;
  championPickPoints: number;
  runnerUpPickPoints: number;
  thirdPlacePickPoints: number;
  finalsChallengePoints: number;
  rank: number;
  projectedPrize: number;
  prizeLabel: "Projected" | "Won";
  closestFinalScoreDiff: number | null;
  podiumPicks?: PlayerPodiumDisplay | null;
  recentForm?: PickFormSlot[];
  /** Total points if live matches score at current live score */
  provisionalTotalPoints?: number;
  /** Extra points from live match(es) not yet final */
  livePoints?: number;
  /** Rank change vs before the most recent results day */
  rankMovement?: "up" | "down" | "same";
}

export interface SessionPlayer {
  id: string;
  display_name: string;
  avatar_emoji: string;
  is_admin: boolean;
  paid: boolean;
}

export const GROUP_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
] as const;

export const KNOCKOUT_STAGES: MatchStage[] = [
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
];

export function isKnockoutStage(stage: MatchStage): boolean {
  return KNOCKOUT_STAGES.includes(stage);
}

export function getMaxMatchPoints(
  match: Pick<
    Match,
    | "stage"
    | "home_win_bonus"
    | "draw_bonus"
    | "away_win_bonus"
    | "home_implied_probability"
    | "draw_implied_probability"
    | "away_implied_probability"
    | "home_advance_bonus"
    | "away_advance_bonus"
  >,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): number {
  return maxPossibleMatchPoints(match, config);
}

export function getStageLabel(stage: MatchStage): string {
  const labels: Record<MatchStage, string> = {
    group: "Group",
    round_of_32: "Round of 32",
    round_of_16: "Round of 16",
    quarterfinal: "Quarterfinal",
    semifinal: "Semifinal",
    third_place: "3rd Place",
    final: "Final",
  };
  return labels[stage];
}
