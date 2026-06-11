"use client";

import { useMemo, useState } from "react";
import { LeaderboardTable } from "./LeaderboardTable";
import { PageHeader } from "./PageHeader";
import type { LeaderboardEntry } from "@/lib/types";
import {
  filterLeaderboard,
  type LeaderboardFilter,
} from "@/lib/leaderboardFilter";
import { mergeLeaderboard, useLiveRefresh } from "@/lib/hooks/useLiveRefresh";
import { PoolHighlightsSection } from "./PoolHighlights";
import type { PoolHighlights } from "@/lib/poolHighlights";

interface LeaderboardClientProps {
  leaderboard: LeaderboardEntry[];
  prizePool: number;
  poolHighlights: PoolHighlights;
  pollLive?: boolean;
  initialHasLiveScoring?: boolean;
}

export function LeaderboardClient({
  leaderboard: initialLeaderboard,
  prizePool,
  poolHighlights,
  pollLive = false,
  initialHasLiveScoring = false,
}: LeaderboardClientProps) {
  const [filter, setFilter] = useState<LeaderboardFilter>("paid");
  const { data } = useLiveRefresh(pollLive);

  const hasLiveScoring = data?.hasLiveScoring ?? initialHasLiveScoring;
  const leaderboard = useMemo(
    () => mergeLeaderboard(initialLeaderboard, data?.leaderboard),
    [initialLeaderboard, data?.leaderboard]
  );

  const displayedLeaderboard = useMemo(
    () => filterLeaderboard(leaderboard, filter, prizePool),
    [leaderboard, filter, prizePool]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leaderboard"
        subtitle={
          hasLiveScoring
            ? filter === "paid"
              ? "Live standings among players in the prize pool"
              : "Live standings for everyone who joined"
            : filter === "paid"
              ? "Rankings among players in the prize pool"
              : "Standings for everyone who joined"
        }
      />

      <LeaderboardTable
        entries={displayedLeaderboard}
        filter={filter}
        onFilterChange={setFilter}
        hasLiveScoring={hasLiveScoring}
      />

      <PoolHighlightsSection highlights={poolHighlights} />
    </div>
  );
}
