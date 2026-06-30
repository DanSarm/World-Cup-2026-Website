import type { LeaderboardEntry } from "./types";
import type { PlayerPickSummary } from "./playerProfile";

export interface PlayerPickStats {
  exact: number;
  correct: number;
  wrong: number;
  decided: number;
}

/** Finished-match pick record — scoring exact, correct winner (not exact), or wrong. */
export function computePlayerPickStats(
  picks: PlayerPickSummary[]
): PlayerPickStats {
  const scored = picks.filter((p) => p.status === "scored");
  const exact = scored.filter((p) => p.exactScore).length;
  const correct = scored.filter(
    (p) => p.correctResult && !p.exactScore
  ).length;
  const wrong = scored.filter((p) => !p.correctResult).length;

  return {
    exact,
    correct,
    wrong,
    decided: scored.length,
  };
}

/** Profile header stats — always match leaderboard entry counts. */
export function pickStatsFromLeaderboardEntry(
  picks: PlayerPickSummary[],
  entry: Pick<LeaderboardEntry, "exactScores" | "correctResults">
): PlayerPickStats {
  const decided = picks.filter((p) => p.status === "scored").length;
  return {
    exact: entry.exactScores,
    correct: entry.correctResults - entry.exactScores,
    wrong: Math.max(0, decided - entry.correctResults),
    decided,
  };
}
