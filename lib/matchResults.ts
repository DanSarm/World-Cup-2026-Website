import type { PickScore } from "./groupStandings";
import type { Match } from "./types";

/** Group-stage match with a settled score (counts toward standings / bracket). */
export function isGroupMatchFinalized(match: Match): boolean {
  if (match.stage !== "group") return false;
  if (match.home_score == null || match.away_score == null) return false;
  return match.status === "final" || match.status === "locked";
}

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

/** Settled group-stage score for standings and knockout slot resolution. */
export function getStandingsMatchScore(match: Match): PickScore | null {
  if (!isGroupMatchFinalized(match)) return null;
  if (match.home_score == null || match.away_score == null) return null;
  return { home: match.home_score, away: match.away_score };
}

export function hasActualMatchResult(match: Match | undefined): boolean {
  if (!match) return false;
  return getActualMatchScore(match) != null;
}
