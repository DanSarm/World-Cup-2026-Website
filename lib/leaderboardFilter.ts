import type { LeaderboardEntry } from "./types";
import { calculatePrizeAmount, paidPayoutPercent } from "./payouts";

export type LeaderboardFilter = "everyone" | "paid";

function entryPoints(entry: LeaderboardEntry): number {
  return entry.provisionalTotalPoints ?? entry.totalPoints;
}

export function rerankLeaderboardEntries(
  entries: LeaderboardEntry[]
): LeaderboardEntry[] {
  return [...entries]
    .sort(
      (a, b) =>
        entryPoints(b) - entryPoints(a) ||
        b.exactScores - a.exactScores ||
        a.displayName.localeCompare(b.displayName)
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function attachPaidProjectedPrizes(
  entries: LeaderboardEntry[],
  prizePool: number
): LeaderboardEntry[] {
  return entries.map((entry) => {
    const percent = paidPayoutPercent(entry.rank);
    return {
      ...entry,
      projectedPrize:
        percent > 0 ? calculatePrizeAmount(prizePool, percent) : 0,
    };
  });
}

export function filterLeaderboard(
  entries: LeaderboardEntry[],
  filter: LeaderboardFilter,
  prizePool: number
): LeaderboardEntry[] {
  if (filter === "everyone") return entries;
  return attachPaidProjectedPrizes(
    rerankLeaderboardEntries(entries.filter((entry) => entry.paid)),
    prizePool
  );
}
