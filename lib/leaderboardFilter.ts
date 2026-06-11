import type { LeaderboardEntry } from "./types";
import { distributeRankedPrizes } from "./payouts";
import { assignCompetitionRanksImmutable } from "./competitionRank";

export type LeaderboardFilter = "everyone" | "paid";

function entryPoints(entry: LeaderboardEntry): number {
  return entry.provisionalTotalPoints ?? entry.totalPoints;
}

export function rerankLeaderboardEntries(
  entries: LeaderboardEntry[]
): LeaderboardEntry[] {
  const sorted = [...entries].sort(
    (a, b) =>
      entryPoints(b) - entryPoints(a) ||
      a.displayName.localeCompare(b.displayName)
  );
  return assignCompetitionRanksImmutable(sorted, entryPoints);
}

export function attachPaidProjectedPrizes(
  entries: LeaderboardEntry[],
  prizePool: number
): LeaderboardEntry[] {
  const prizes = distributeRankedPrizes(entries, prizePool);

  return entries.map((entry) => ({
    ...entry,
    projectedPrize: prizes.get(entry.playerId) ?? 0,
  }));
}

export function filterLeaderboard(
  entries: LeaderboardEntry[],
  filter: LeaderboardFilter,
  prizePool: number
): LeaderboardEntry[] {
  const source = entries.map((entry) => ({ ...entry }));
  const subset =
    filter === "paid" ? source.filter((entry) => entry.paid) : source;
  const reranked = rerankLeaderboardEntries(subset);
  if (filter === "paid") {
    return attachPaidProjectedPrizes(reranked, prizePool);
  }
  return reranked;
}
