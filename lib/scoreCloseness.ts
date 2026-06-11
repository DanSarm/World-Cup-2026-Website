/** Score closeness bonus — total goal error between predicted and actual scores. */

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

/** Closeness bonus when the result/advancer is already correct. */
export function closenessBonus(error: number): number {
  if (error === 0) return 0;
  if (error === 1) return 2;
  if (error === 2) return 1;
  return 0;
}

export function closenessBonusLabel(error: number): string | null {
  if (error === 0) return null;
  if (error === 1) return "One goal off +2";
  if (error === 2) return "Two goals off +1";
  return null;
}
