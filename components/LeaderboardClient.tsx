"use client";

import { useState } from "react";
import { LeaderboardTable } from "./LeaderboardTable";
import { StatCards } from "./StatCards";
import { PageHeader } from "./PageHeader";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardClientProps {
  leaderboard: LeaderboardEntry[];
  finalsLeaderboard: Array<{
    playerId: string;
    displayName: string;
    avatarEmoji: string;
    points: number;
    rank: number;
  }>;
  funStats: {
    mostPoints: { name: string; points: number } | null;
    mostExactScores: { name: string; count: number } | null;
    mostMiraclePoints: { name: string; points: number } | null;
    bestPerfectDay: { name: string; count: number } | null;
    biggestMover: { name: string; delta: number } | null;
  };
  isAdmin: boolean;
  prizeLabel: "Projected" | "Won";
}

type Mode = "points" | "exact" | "finals";

export function LeaderboardClient({
  leaderboard,
  finalsLeaderboard,
  funStats,
  isAdmin,
  prizeLabel,
}: LeaderboardClientProps) {
  const [mode, setMode] = useState<Mode>("points");

  const modes: { key: Mode; label: string }[] = [
    { key: "points", label: "Points" },
    { key: "exact", label: "Exact" },
    { key: "finals", label: "Finals" },
  ];

  const sortedExact = [...leaderboard].sort(
    (a, b) => b.exactScores - a.exactScores || b.totalPoints - a.totalPoints
  );

  return (
    <div className="space-y-6">
      <PageHeader
        flags={["ARG", "FRA", "BRA", "GER"]}
        title="Leaderboard"
        subtitle={
          prizeLabel === "Won"
            ? "Final winnings"
            : "Projected prizes if the cup ended now"
        }
      />

      <div className="segmented">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            type="button"
            className={`segment ${mode === m.key ? "segment-active" : ""}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <LeaderboardTable
        entries={
          mode === "exact"
            ? sortedExact.map((e, i) => ({ ...e, rank: i + 1 }))
            : leaderboard
        }
        mode={mode}
        finalsData={finalsLeaderboard}
        showPaid={isAdmin}
        prizeLabel={prizeLabel}
      />

      <StatCards {...funStats} />
    </div>
  );
}
