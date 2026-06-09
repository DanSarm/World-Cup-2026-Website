"use client";

import { useState } from "react";
import type { LeaderboardEntry } from "@/lib/types";
import type { FlagSize } from "@/lib/flags";
import { PlayerPodiumFlags } from "./PlayerPodiumFlags";
import { RecentPickFormDots } from "./RecentPickFormDots";
import { formatMoney } from "@/lib/payouts";

import { type LeaderboardFilter } from "@/lib/leaderboardFilter";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  filter: LeaderboardFilter;
  onFilterChange: (filter: LeaderboardFilter) => void;
  hasLiveScoring?: boolean;
}

export function LeaderboardTable({
  entries,
  filter,
  onFilterChange,
  hasLiveScoring = false,
}: LeaderboardTableProps) {
  const [expanded, setExpanded] = useState(false);

  const shown = expanded ? entries : entries.slice(0, 10);
  const podiumEntries = shown.filter((entry) => entry.rank <= 3);
  const restEntries = shown.filter((entry) => entry.rank > 3);

  const rankDisplay = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank;
  };

  const podiumClass = (rank: number) => {
    if (rank === 1) return "lb-entry--first";
    if (rank === 2) return "lb-entry--second";
    if (rank === 3) return "lb-entry--third";
    return "";
  };

  const podiumFlagSize = (rank: number): FlagSize => {
    if (rank === 1) return "md";
    if (rank === 2) return "sm";
    return "xs";
  };

  const renderEntry = (entry: LeaderboardEntry) => {
    const displayValue =
      hasLiveScoring && entry.provisionalTotalPoints != null
        ? entry.provisionalTotalPoints
        : entry.totalPoints;

    return (
      <li
        key={entry.playerId}
        className={`lb-entry ${podiumClass(entry.rank)}`}
      >
        <span
          className={`lb-entry-rank ${
            entry.rank <= 3 ? "lb-entry-rank--medal" : ""
          }`}
        >
          {rankDisplay(entry.rank)}
        </span>

        <div className="lb-entry-main min-w-0 flex-1">
          <p className="lb-entry-name flex items-center gap-1.5">
            <PlayerPodiumFlags
              picks={entry.podiumPicks}
              fallbackEmoji={entry.avatarEmoji}
              size={entry.rank <= 3 ? podiumFlagSize(entry.rank) : "xs"}
              className="!w-auto"
            />
            <span className="truncate">{entry.displayName}</span>
          </p>
          <p className="lb-entry-meta">
            {entry.picksMade} {entry.picksMade === 1 ? "pick" : "picks"}
            {entry.exactScores > 0 && (
              <span> · {entry.exactScores} exact</span>
            )}
          </p>
        </div>

        <RecentPickFormDots form={entry.recentForm ?? []} />

        <div className="lb-entry-score shrink-0 text-right">
          <p className="lb-entry-score-value">{displayValue}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint mt-0.5">
            pts
            {hasLiveScoring && (entry.livePoints ?? 0) > 0 && (
              <span className="normal-case text-mexico font-bold">
                {" "}
                · +{entry.livePoints} live
              </span>
            )}
          </p>
          {filter === "paid" && entry.rank <= 4 && entry.projectedPrize > 0 && (
            <p className="text-[11px] font-bold text-mexico tabular-nums mt-1">
              {formatMoney(entry.projectedPrize)}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-ink/5 space-y-3">
        {hasLiveScoring && (
          <p className="text-xs font-semibold text-canada">
            Live match in progress — totals include provisional points from the
            current score
          </p>
        )}
        <div className="segmented-light">
          <button
            type="button"
            onClick={() => onFilterChange("paid")}
            className={`segment-light ${filter === "paid" ? "segment-light-active" : ""}`}
          >
            Paid only
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("everyone")}
            className={`segment-light ${filter === "everyone" ? "segment-light-active" : ""}`}
          >
            Everyone
          </button>
        </div>
      </div>

      <div className="divide-y divide-ink/5">
        {podiumEntries.length > 0 && (
          <ul className="lb-podium-block list-none divide-y divide-ink/[0.06]">
            {podiumEntries.map(renderEntry)}
          </ul>
        )}
        {restEntries.length > 0 && (
          <ul className="list-none divide-y divide-ink/5">
            {restEntries.map(renderEntry)}
          </ul>
        )}
      </div>

      {entries.length === 0 && (
        <p className="text-center text-ink-faint py-10 text-sm">
          {filter === "paid" ? "No paid players yet" : "No players yet"}
        </p>
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
