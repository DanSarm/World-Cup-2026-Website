"use client";

import { useState } from "react";
import { LeaderboardTable } from "./LeaderboardTable";
import { StatCards } from "./StatCards";
import { PageHeader } from "./PageHeader";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardClientProps {
  leaderboard: LeaderboardEntry[];
  funStats: {
    mostPoints: { name: string; points: number } | null;
    mostExactScores: { name: string; count: number } | null;
    mostMiraclePoints: { name: string; points: number } | null;
    bestPerfectDay: { name: string; count: number } | null;
  };
}

type Mode = "points" | "exact";

export function LeaderboardClient({
  leaderboard,
  funStats,
}: LeaderboardClientProps) {
  const [mode, setMode] = useState<Mode>("points");

  const sortedExact = [...leaderboard].sort(
    (a, b) => b.exactScores - a.exactScores || b.totalPoints - a.totalPoints
  );

  return (
    <div className="space-y-6">
      <PageHeader
        flags={["ARG", "FRA", "BRA", "GER"]}
        title="Leaderboard"
        subtitle="Live standings from saved picks"
      />

      <LeaderboardTable
        entries={
          mode === "exact"
            ? sortedExact.map((e, i) => ({ ...e, rank: i + 1 }))
            : leaderboard
        }
        mode={mode}
        onModeChange={setMode}
      />

      <StatCards {...funStats} />
    </div>
  );
}
