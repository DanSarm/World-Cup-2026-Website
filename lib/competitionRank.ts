/**
 * Leaderboard ranking with no skipped places (1, 1, 2, 3 …).
 * Tied players share the same rank; the next distinct score is the next place.
 */
export function assignCompetitionRanks<T extends { rank: number }>(
  entries: T[],
  getPoints: (entry: T) => number
): T[] {
  const tiers = [...new Set(entries.map(getPoints))].sort((a, b) => b - a);
  const rankByPoints = new Map(tiers.map((pts, index) => [pts, index + 1]));

  for (const entry of entries) {
    entry.rank = rankByPoints.get(getPoints(entry)) ?? tiers.length + 1;
  }
  return entries;
}

export function assignCompetitionRanksImmutable<T>(
  entries: T[],
  getPoints: (entry: T) => number
): Array<T & { rank: number }> {
  const tiers = [...new Set(entries.map(getPoints))].sort((a, b) => b - a);
  const rankByPoints = new Map(tiers.map((pts, index) => [pts, index + 1]));

  return entries.map((entry) => ({
    ...entry,
    rank: rankByPoints.get(getPoints(entry)) ?? tiers.length + 1,
  }));
}
