import type { Match, MatchPrediction } from "./types";
import { canPickMatch } from "./utils";
import { hasSavedPick } from "./pickUtils";

/** Earliest open match by kickoff — for the home page regardless of pick status. */
export function findNextUpcomingMatch(matches: Match[]): Match | null {
  return (
    matches
      .filter((m) => canPickMatch(m))
      .sort((a, b) =>
        (a.kickoff_at ?? "9999").localeCompare(b.kickoff_at ?? "9999")
      )[0] ?? null
  );
}

export function findNextMatchNeedingPick(
  matches: Match[],
  predictions: Map<string, MatchPrediction>
): Match | null {
  return (
    matches
      .filter(
        (m) => canPickMatch(m) && !hasSavedPick(predictions.get(m.id))
      )
      .sort((a, b) =>
        (a.kickoff_at ?? "9999").localeCompare(b.kickoff_at ?? "9999")
      )[0] ?? null
  );
}
