"use client";

import { useState } from "react";
import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  mode: "points" | "exact";
  onModeChange: (mode: "points" | "exact") => void;
}

export function LeaderboardTable({
  entries,
  mode,
  onModeChange,
}: LeaderboardTableProps) {
  const [expanded, setExpanded] = useState(false);

  const shown = expanded ? entries : entries.slice(0, 10);

  const rankDisplay = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank;
  };

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-ink/5">
        <div className="segmented-light">
          <button
            type="button"
            onClick={() => onModeChange("points")}
            className={`segment-light ${mode === "points" ? "segment-light-active" : ""}`}
          >
            Total points
          </button>
          <button
            type="button"
            onClick={() => onModeChange("exact")}
            className={`segment-light ${mode === "exact" ? "segment-light-active" : ""}`}
          >
            Exact scores
          </button>
        </div>
      </div>

      <ul className="divide-y divide-ink/5">
        {shown.map((entry) => {
          const primaryValue =
            mode === "exact" ? entry.exactScores : entry.totalPoints;
          const primaryLabel = mode === "exact" ? "exact" : "pts";

          return (
            <li key={entry.playerId} className="lb-entry">
              <span
                className={`lb-entry-rank ${
                  entry.rank <= 3 ? "lb-entry-rank--medal" : ""
                }`}
              >
                {rankDisplay(entry.rank)}
              </span>

              <div className="lb-entry-main min-w-0 flex-1">
                <p className="font-semibold text-ink truncate leading-tight">
                  <span className="mr-1">{entry.avatarEmoji}</span>
                  {entry.displayName}
                </p>
                <p className="text-[11px] text-ink-faint mt-0.5 tabular-nums">
                  {entry.picksMade}{" "}
                  {entry.picksMade === 1 ? "pick" : "picks"}
                  {mode === "points" && entry.exactScores > 0 && (
                    <span> · {entry.exactScores} exact</span>
                  )}
                  {mode === "exact" && (
                    <span> · {entry.totalPoints} pts total</span>
                  )}
                </p>
              </div>

              <div className="lb-entry-score shrink-0 text-right">
                <p className="font-extrabold text-usa tabular-nums text-xl leading-none">
                  {primaryValue}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint mt-0.5">
                  {primaryLabel}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {entries.length === 0 && (
        <p className="text-center text-ink-faint py-10 text-sm">No players yet</p>
      )}

      {entries.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3.5 text-sm text-usa font-semibold hover:bg-cream/80 transition-colors border-t border-ink/5"
          type="button"
        >
          {expanded ? "Show less" : `Show all ${entries.length} players`}
        </button>
      )}
    </div>
  );
}
