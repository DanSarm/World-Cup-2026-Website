import type { Match, MatchPrediction } from "./types";
import { canPickMatch } from "./utils";
import { hasSavedPick } from "./pickUtils";

function sortPickableByKickoff(matches: Match[]): Match[] {
  return [...matches]
    .filter((m) => canPickMatch(m))
    .sort((a, b) =>
      (a.kickoff_at ?? "9999").localeCompare(b.kickoff_at ?? "9999")
    );
}

/** Earliest open match by kickoff — for the home page regardless of pick status. */
export function findNextUpcomingMatch(matches: Match[]): Match | null {
  return sortPickableByKickoff(matches)[0] ?? null;
}

/** Next N open matches by kickoff (home page upcoming queue). */
export function findNextUpcomingMatches(
  matches: Match[],
  limit = 2
): Match[] {
  return sortPickableByKickoff(matches).slice(0, limit);
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
