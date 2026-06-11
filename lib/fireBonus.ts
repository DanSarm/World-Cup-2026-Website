/** Exact Score Fire Bonus — rewards rare exact scorelines. */

export interface FireBonusInput {
  isExactScore: boolean;
  isDraw: boolean;
  totalGoals: number;
  winningMargin: number;
  outcomeBonus: number;
  enabled?: boolean;
}

export function calculateExactScoreFireBonus({
  isExactScore,
  isDraw,
  totalGoals,
  winningMargin,
  outcomeBonus,
  enabled = true,
}: FireBonusInput): number {
  if (!enabled || !isExactScore) return 0;

  if (isDraw) {
    let fireBonus = 0;
    if (totalGoals >= 6) fireBonus += 2;
    else if (totalGoals >= 4) fireBonus += 1;

    if (outcomeBonus >= 6 && totalGoals >= 2) fireBonus += 1;

    return Math.min(fireBonus, 4);
  }

  if (outcomeBonus >= 6) {
    if (winningMargin >= 3) return 4;
    if (winningMargin === 2) return 3;
    return 2;
  }
  if (outcomeBonus >= 4) {
    if (winningMargin >= 3) return 3;
    if (winningMargin === 2) return 2;
    return 1;
  }
  if (outcomeBonus >= 2) {
    if (winningMargin >= 3) return 2;
    if (winningMargin === 2) return 1;
    return 0;
  }
  if (winningMargin >= 5) return 2;
  if (winningMargin >= 3) return 1;
  return 0;
}

export function pickPreviewLabel(possiblePoints: number): string {
  if (possiblePoints <= 8) return "Solid pick";
  if (possiblePoints <= 12) return "Nice pick";
  if (possiblePoints <= 16) return "Brave pick 🔥";
  return "Miracle pick 🚀";
}
