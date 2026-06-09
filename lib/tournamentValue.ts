import type { Team } from "./types";

export type TournamentPickPlace = "champion" | "runnerUp" | "thirdPlace";

export const TOURNAMENT_VALUE_MIN = 5;
export const TOURNAMENT_VALUE_MAX = 250;

export const PLACE_MULTIPLIERS: Record<TournamentPickPlace, number> = {
  champion: 1,
  runnerUp: 0.45,
  thirdPlace: 0.3,
};

export type TeamMarketFields = Pick<
  Team,
  "market_win_percentage" | "tournament_value_override"
>;

/**
 * Base tournament value of a team from its pre-tournament market win %.
 * round(100 / pct), clamped to 5-250. Favorites ≈ 5-12, mid longshots
 * ≈ 20-90, huge underdogs ≈ 125-250.
 */
export function calculateTeamTournamentValue(
  team: TeamMarketFields | null | undefined
): number {
  if (!team) return 0;
  if (
    team.tournament_value_override != null &&
    team.tournament_value_override > 0
  ) {
    return Math.min(
      TOURNAMENT_VALUE_MAX,
      Math.max(TOURNAMENT_VALUE_MIN, Math.round(team.tournament_value_override))
    );
  }
  const pct = team.market_win_percentage;
  if (pct == null || pct <= 0) return 0;
  const rawValue = Math.round(100 / pct);
  return Math.min(TOURNAMENT_VALUE_MAX, Math.max(TOURNAMENT_VALUE_MIN, rawValue));
}

/** Points awarded if this team is picked in this exact final position. */
export function tournamentPlacePoints(
  team: TeamMarketFields | null | undefined,
  place: TournamentPickPlace
): number {
  const value = calculateTeamTournamentValue(team);
  if (value <= 0) return 0;
  return Math.round(value * PLACE_MULTIPLIERS[place]);
}

export interface PickRiskLabel {
  label: "Safe pick" | "Brave pick" | "Longshot" | "Miracle";
  emoji: string;
}

/** Simple risk label shown to users instead of formulas. */
export function pickRiskLabel(points: number): PickRiskLabel {
  if (points >= 121) return { label: "Miracle", emoji: "🚀" };
  if (points >= 51) return { label: "Longshot", emoji: "🔥" };
  if (points >= 16) return { label: "Brave pick", emoji: "💪" };
  return { label: "Safe pick", emoji: "" };
}

/**
 * User-facing market win %. Uses the stored market_label (e.g. "<1%")
 * when present; calculations always use the stored percentage.
 */
export function formatMarketWinPercent(
  team: Pick<Team, "market_win_percentage" | "market_label"> | null | undefined
): string {
  if (!team) return "—";
  if (team.market_label) return team.market_label;
  const pct = team.market_win_percentage;
  if (pct == null || pct <= 0) return "—";
  if (pct < 1) return "<1%";
  return `${Number.isInteger(pct) ? pct : Number(pct.toFixed(1))}%`;
}

/** Estimated win % for teams listed as "<1%", based on market rank. */
export function estimateWinPercentageFromRank(rank: number): number {
  if (rank <= 24) return 0.8;
  if (rank <= 32) return 0.5;
  return 0.4;
}
