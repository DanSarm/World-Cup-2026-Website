/** Convert decimal odds to implied probability. */
export function decimalToImplied(decimalPrice: number): number {
  if (decimalPrice <= 1) return 0;
  return 1 / decimalPrice;
}

/** Remove bookmaker vig from 3-way (or 2-way) outcomes. */
export function calculateNoVigProbabilities(
  raw: { home: number; draw?: number; away: number }
): { home: number; draw: number; away: number } {
  const homeRaw = raw.home;
  const drawRaw = raw.draw ?? 0;
  const awayRaw = raw.away;
  const total = homeRaw + drawRaw + awayRaw;
  if (total <= 0) {
    return { home: 0, draw: 0, away: 0 };
  }
  return {
    home: homeRaw / total,
    draw: drawRaw / total,
    away: awayRaw / total,
  };
}

/** Map implied probability to bonus points for harder picks. */
export function probabilityToBonus(prob: number): number {
  if (prob >= 0.5) return 0;
  if (prob >= 0.35) return 1;
  if (prob >= 0.2) return 2;
  if (prob >= 0.1) return 4;
  if (prob >= 0.05) return 6;
  return 8;
}

/** Short user-facing label for a bonus tier (0 = no label). */
export function bonusTierLabel(bonus: number): string | null {
  switch (bonus) {
    case 1:
      return "Sneaky +1";
    case 2:
      return "Brave +2";
    case 4:
      return "Shock +4";
    case 6:
      return "Miracle +6";
    case 8:
      return "Impossible +8";
    default:
      return null;
  }
}

/** Champion longshot bonus from pre-tournament win probability. */
export function championProbabilityToLongshotBonus(prob: number): number {
  if (prob >= 0.12) return 0;
  if (prob >= 0.05) return 5;
  if (prob >= 0.02) return 10;
  if (prob >= 0.01) return 15;
  return 25;
}

export function decimalToAmerican(decimalPrice: number): number {
  if (decimalPrice <= 1) return 0;
  if (decimalPrice >= 2) {
    return Math.round((decimalPrice - 1) * 100);
  }
  return Math.round(-100 / (decimalPrice - 1));
}

export function average(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
