import { parseISO } from "date-fns";
import { isMatchInPlayWindow } from "./matchLive";
import type { Match } from "./types";

type MatchFinalizeFields = Pick<
  Match,
  "status" | "home_score" | "away_score" | "kickoff_at" | "home_team_id"
>;

/** Played match left as scheduled — promote to final so scoring stays correct. */
export function shouldPromoteScheduledMatchWithScores(
  match: MatchFinalizeFields,
  now = Date.now()
): boolean {
  if (match.status !== "scheduled") return false;
  if (match.home_score === null || match.away_score === null) return false;
  if (!match.kickoff_at) return false;
  if (isMatchInPlayWindow(match)) return false;
  return parseISO(match.kickoff_at).getTime() <= now;
}

export function matchIdsToPromoteScheduledWithScores(
  matches: MatchFinalizeFields[],
  now = Date.now()
): number {
  return matches.filter((m) => shouldPromoteScheduledMatchWithScores(m, now))
    .length;
}
