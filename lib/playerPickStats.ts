import type { PlayerPickSummary } from "./playerProfile";

export interface PlayerPickStats {
  exact: number;
  correct: number;
  wrong: number;
  decided: number;
}

/** Finished-match pick record — exact, correct winner (not exact), or wrong. */
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
