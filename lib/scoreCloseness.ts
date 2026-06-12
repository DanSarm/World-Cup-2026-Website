/** Exact score bonus and goal-error helper for scoring. */

export const EXACT_SCORE_BONUS = 5;

export function scoreError(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): number {
  return (
    Math.abs(predHome - actualHome) + Math.abs(predAway - actualAway)
  );
}
