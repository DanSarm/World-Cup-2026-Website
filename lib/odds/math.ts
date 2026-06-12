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
  if (prob >= 0.35) return 0;
  if (prob >= 0.25) return 0;
  if (prob >= 0.2) return 1;
  if (prob >= 0.1) return 4;
  if (prob >= 0.05) return 6;
  return 8;
}

/**
 * Competitive three-way match — no clear favorite and every outcome ≥ 25%.
 * favorite < 50% and home, draw, away each at least 25%.
 */
export function isCompetitiveThreeWayMatch(
  homeProb: number,
  drawProb: number,
  awayProb: number
): boolean {
  const favorite = Math.max(homeProb, drawProb, awayProb);
  return (
    favorite < 0.5 &&
    homeProb >= 0.25 &&
    drawProb >= 0.25 &&
    awayProb >= 0.25
  );
}

/** @deprecated use isCompetitiveThreeWayMatch */
export function isBalancedThreeWayMatch(
  homeProb: number,
  drawProb: number,
  awayProb: number
): boolean {
  return isCompetitiveThreeWayMatch(homeProb, drawProb, awayProb);
}

export interface GroupOutcomeBonuses {
  home: number;
  draw: number;
  away: number;
}

/** Group-stage outcome bonuses from no-vig implied probabilities. */
export function groupStageOutcomeBonusesFromImplied(
  homeProb: number,
  drawProb: number,
  awayProb: number
): GroupOutcomeBonuses {
  if (isCompetitiveThreeWayMatch(homeProb, drawProb, awayProb)) {
    return { home: 0, draw: 0, away: 0 };
  }
  return {
    home: probabilityToBonus(homeProb),
    draw: probabilityToBonus(drawProb),
    away: probabilityToBonus(awayProb),
  };
}

export function resolveGroupOutcomeBonuses(
  match: {
    home_win_bonus?: number | null;
    draw_bonus?: number | null;
    away_win_bonus?: number | null;
    home_implied_probability?: number | null;
    draw_implied_probability?: number | null;
    away_implied_probability?: number | null;
  }
): GroupOutcomeBonuses {
  const hp = match.home_implied_probability;
  const dp = match.draw_implied_probability;
  const ap = match.away_implied_probability;
  if (hp != null && dp != null && ap != null) {
    return groupStageOutcomeBonusesFromImplied(hp, dp, ap);
  }
  return {
    home: match.home_win_bonus ?? 0,
    draw: match.draw_bonus ?? 0,
    away: match.away_win_bonus ?? 0,
  };
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
