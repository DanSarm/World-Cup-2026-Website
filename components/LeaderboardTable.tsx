"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/payouts";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  mode: "points" | "exact" | "finals";
  finalsData?: Array<{
    playerId: string;
    displayName: string;
    avatarEmoji: string;
    points: number;
    rank: number;
  }>;
  showPaid?: boolean;
  prizeLabel?: "Projected" | "Won";
}

export function LeaderboardTable({
  entries,
  mode,
  finalsData,
  showPaid,
  prizeLabel = "Projected",
}: LeaderboardTableProps) {
  const [expanded, setExpanded] = useState(false);

  const displayEntries = mode === "finals" && finalsData ? finalsData : entries;
  const shown = expanded ? displayEntries : displayEntries.slice(0, 10);

  const rankDisplay = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank;
  };

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-usa text-white/90 text-[10px] uppercase tracking-widest font-bold">
              <th className="py-3 px-4 text-left w-12">#</th>
              <th className="py-3 px-4 text-left">Player</th>
              {mode === "points" && (
                <>
                  <th className="py-3 px-3 text-right">Pts</th>
                  <th className="py-3 px-3 text-right">🎯</th>
                  <th className="py-3 px-3 text-right">🔥</th>
                  <th className="py-3 px-3 text-right">{prizeLabel === "Won" ? "Won" : "Proj."}</th>
                </>
              )}
              {mode === "exact" && (
                <>
                  <th className="py-3 px-3 text-right">Exact</th>
                  <th className="py-3 px-3 text-right">Pts</th>
                </>
              )}
              {mode === "finals" && (
                <th className="py-3 px-3 text-right">Pts</th>
              )}
              {showPaid && <th className="py-3 px-3 text-center">Paid</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((entry) => {
              const isLeaderboard = "totalPoints" in entry;
              const rank = entry.rank;

              return (
                <tr
                  key={isLeaderboard ? (entry as LeaderboardEntry).playerId : entry.playerId}
                  className="lb-row"
                >
                  <td className="font-bold text-ink-faint tabular-nums">
                    {rankDisplay(rank)}
                  </td>
                  <td className="font-semibold text-ink truncate max-w-[120px]">
                    {isLeaderboard
                      ? `${(entry as LeaderboardEntry).avatarEmoji} ${(entry as LeaderboardEntry).displayName}`
                      : `${entry.avatarEmoji} ${entry.displayName}`}
                  </td>
                  {mode === "points" && isLeaderboard && (
                    <>
                      <td className="text-right font-extrabold text-usa tabular-nums">
                        {(entry as LeaderboardEntry).totalPoints}
                      </td>
                      <td className="text-right text-ink-muted tabular-nums">
                        {(entry as LeaderboardEntry).exactScores}
                      </td>
                      <td className="text-right text-mexico font-semibold tabular-nums">
                        {(entry as LeaderboardEntry).miraclePoints}
                      </td>
                      <td className="text-right font-semibold text-gold-dark tabular-nums">
                        {(entry as LeaderboardEntry).projectedPrize > 0
                          ? formatMoney((entry as LeaderboardEntry).projectedPrize)
                          : "—"}
                      </td>
                    </>
                  )}
                  {mode === "exact" && isLeaderboard && (
                    <>
                      <td className="text-right font-extrabold text-usa tabular-nums">
                        {(entry as LeaderboardEntry).exactScores}
                      </td>
                      <td className="text-right text-ink-muted tabular-nums">
                        {(entry as LeaderboardEntry).totalPoints}
                      </td>
                    </>
                  )}
                  {mode === "finals" && !isLeaderboard && (
                    <td className="text-right font-extrabold text-usa tabular-nums">
                      {entry.points}
                    </td>
                  )}
                  {showPaid && isLeaderboard && (
                    <td className="text-center">
                      {(entry as LeaderboardEntry).paid ? "✅" : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {displayEntries.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-sm text-usa font-semibold hover:bg-cream transition-colors border-t border-ink/5"
          type="button"
        >
          {expanded ? "Show less" : `Show all ${displayEntries.length}`}
        </button>
      )}
    </div>
  );
}
