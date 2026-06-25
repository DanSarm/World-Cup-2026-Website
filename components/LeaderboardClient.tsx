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
import {
  filterProgressionForPlayers,
  type LeaderboardProgression,
} from "@/lib/leaderboardProgression";
import { LeaderboardProgressionChart } from "./LeaderboardProgressionChart";

interface LeaderboardClientProps {
  leaderboard: LeaderboardEntry[];
  prizePool: number;
  progression: LeaderboardProgression;
  paidPlayerIds: string[];
  currentPlayerId: string;
  pollLive?: boolean;
  initialHasLiveScoring?: boolean;
}

export function LeaderboardClient({
  leaderboard: initialLeaderboard,
  prizePool,
  progression,
  paidPlayerIds,
  currentPlayerId,
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

  const allPlayerIds = useMemo(
    () => new Set(leaderboard.map((e) => e.playerId)),
    [leaderboard]
  );

  const filteredProgression = useMemo(
    () =>
      filterProgressionForPlayers(
        progression,
        filter === "paid" ? new Set(paidPlayerIds) : allPlayerIds
      ),
    [progression, filter, paidPlayerIds, allPlayerIds]
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

      <LeaderboardProgressionChart
        progression={filteredProgression}
        variant="pool"
        size="large"
        title={filter === "paid" ? "Prize pool points" : "Everyone's points"}
        highlightPlayerId={currentPlayerId}
      />
    </div>
  );
}
