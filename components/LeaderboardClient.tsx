"use client";

import { useMemo, useState } from "react";
import { LeaderboardTable } from "./LeaderboardTable";
import { StatCards } from "./StatCards";
import { PageHeader } from "./PageHeader";
import type { LeaderboardEntry } from "@/lib/types";
import {
  filterLeaderboard,
  type LeaderboardFilter,
} from "@/lib/leaderboardFilter";
import { mergeLeaderboard, useLiveRefresh } from "@/lib/hooks/useLiveRefresh";

interface LeaderboardClientProps {
  leaderboard: LeaderboardEntry[];
  prizePool: number;
  funStats: {
    mostPoints: { name: string; points: number } | null;
    mostExactScores: { name: string; count: number } | null;
    mostMiraclePoints: { name: string; points: number } | null;
    bestPerfectDay: { name: string; count: number } | null;
  };
  pollLive?: boolean;
}

export function LeaderboardClient({
  leaderboard: initialLeaderboard,
  prizePool,
  funStats,
  pollLive = false,
}: LeaderboardClientProps) {
  const [filter, setFilter] = useState<LeaderboardFilter>("paid");
  const { data } = useLiveRefresh(pollLive);

  const hasLiveScoring = data?.hasLiveScoring ?? false;
  const leaderboard = useMemo(
    () => mergeLeaderboard(initialLeaderboard, data?.leaderboard),
    [initialLeaderboard, data?.leaderboard]
  );

  const displayedLeaderboard = useMemo(
    () => filterLeaderboard(leaderboard, filter, prizePool),
    [leaderboard, filter, prizePool]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        flags={["ARG", "FRA", "BRA", "GER"]}
        title="Leaderboard"
        subtitle={
          hasLiveScoring
            ? "Live standings — points update with the current score"
            : filter === "paid"
              ? "Rankings among players in the prize pool"
              : "Standings from saved picks"
        }
      />

      <LeaderboardTable
        entries={displayedLeaderboard}
        filter={filter}
        onFilterChange={setFilter}
        hasLiveScoring={hasLiveScoring}
      />

      <StatCards {...funStats} />
    </div>
  );
}
