import type { PickScore } from "./groupStandings";
import type { Match } from "./types";

/** Score from a completed or in-progress match in the database. */
export function getActualMatchScore(match: Match): PickScore | null {
  if (
    (match.status === "final" || match.status === "live") &&
    match.home_score != null &&
    match.away_score != null
  ) {
    return { home: match.home_score, away: match.away_score };
  }
  return null;
}

export function hasActualMatchResult(match: Match | undefined): boolean {
  if (!match) return false;
  return getActualMatchScore(match) != null;
}
