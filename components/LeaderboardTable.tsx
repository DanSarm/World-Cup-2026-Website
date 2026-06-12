"use client";

import Link from "next/link";
import type { LeaderboardEntry } from "@/lib/types";
import { PlayerPodiumFlags } from "./PlayerPodiumFlags";
import { RecentPickFormDots } from "./RecentPickFormDots";
import { formatMoney } from "@/lib/payouts";
import { RankMedal } from "./PlaceMedal";

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
  const podiumEntries = entries.filter((entry) => entry.rank <= 3);
  const restEntries = entries.filter((entry) => entry.rank > 3);

  const rankDisplay = (rank: number) => {
    if (rank <= 3) {
      return (
        <RankMedal
          rank={rank}
          trophySize={rank === 1 ? "leaderboardHero" : "leaderboard"}
        />
      );
    }
    return rank;
  };

  const podiumClass = (rank: number) => {
    if (rank === 1) return "lb-entry--first";
    if (rank === 2) return "lb-entry--second";
    if (rank === 3) return "lb-entry--third";
    return "";
  };

  const movementDisplay = (movement?: LeaderboardEntry["rankMovement"]) => {
    if (movement === "up") {
      return (
        <span className="lb-entry-movement text-mexico-light" aria-label="Moved up">
          ▲
        </span>
      );
    }
    if (movement === "down") {
      return (
        <span className="lb-entry-movement text-canada" aria-label="Moved down">
          ▼
        </span>
      );
    }
    return (
      <span className="lb-entry-movement text-ink/20" aria-label="No change">
        —
      </span>
    );
  };

  const renderEntry = (entry: LeaderboardEntry) => {
    const displayValue =
      hasLiveScoring && entry.provisionalTotalPoints != null
        ? entry.provisionalTotalPoints
        : entry.totalPoints;

    return (
      <li key={entry.playerId}>
        <Link
          href={`/player/${entry.playerId}`}
          className={`lb-entry lb-entry-link ${podiumClass(entry.rank)}`}
        >
        <span
          className={`lb-entry-rank ${
            entry.rank <= 3 ? "lb-entry-rank--medal" : ""
          }`}
        >
          {movementDisplay(entry.rankMovement)}
          <span className="lb-entry-rank-value">{rankDisplay(entry.rank)}</span>
        </span>

        <div className="lb-entry-main min-w-0 flex-1">
          <p className="lb-entry-name flex items-center gap-1.5">
            <PlayerPodiumFlags
              picks={entry.podiumPicks}
              fallbackEmoji={entry.avatarEmoji}
              size="xs"
              className="lb-entry-flags !w-auto"
            />
            <span className="lb-entry-name-text">{entry.displayName}</span>
            {filter === "everyone" && entry.paid && (
              <span
                className="lb-entry-paid-mark"
                title="In the prize pool"
                aria-label="Paid — in the prize pool"
              >
                $
              </span>
            )}
          </p>
          <p className="lb-entry-meta">
            {entry.picksMade} {entry.picksMade === 1 ? "pick" : "picks"}
            {entry.exactScores > 0 && (
              <span> · {entry.exactScores} exact</span>
            )}
            {entry.perfectDaysCount > 0 && (
              <span className="text-mexico font-semibold">
                {" "}
                · Perfect Day{entry.perfectDaysCount > 1 ? ` ×${entry.perfectDaysCount}` : ""} 🎉
              </span>
            )}
          </p>
        </div>

        <RecentPickFormDots
          form={entry.recentForm ?? []}
          className="lb-entry-form"
        />

        <div className="lb-entry-score shrink-0 text-right">
          <p className="lb-entry-score-value inline-flex items-baseline justify-end gap-1">
            <span>{displayValue}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              pts
            </span>
          </p>
          {hasLiveScoring && (entry.livePoints ?? 0) > 0 && (
            <p className="text-[10px] font-semibold text-mexico mt-0.5">
              +{entry.livePoints} live
            </p>
          )}
          {filter === "paid" && entry.rank <= 4 && entry.projectedPrize > 0 && (
            <p className="text-[10px] font-bold text-mexico tabular-nums mt-0.5">
              {formatMoney(entry.projectedPrize)}
            </p>
          )}
        </div>
        </Link>
      </li>
    );
  };

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-2.5 sm:p-3 border-b border-ink/5 space-y-2">
        {hasLiveScoring && (
          <p className="text-xs font-semibold text-canada leading-snug">
            <span className="sm:hidden">Live — totals include provisional points</span>
            <span className="hidden sm:inline">
              Live match in progress — totals include provisional points from the
              current score
            </span>
          </p>
        )}
        <div className="relative z-10 space-y-2">
          <div className="segmented-light" role="tablist" aria-label="Leaderboard view">
            <button
              type="button"
              role="tab"
              aria-selected={filter === "paid"}
              onClick={() => onFilterChange("paid")}
              className={`segment-light cursor-pointer ${filter === "paid" ? "segment-light-active" : ""}`}
            >
              Paid only
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "everyone"}
              onClick={() => onFilterChange("everyone")}
              className={`segment-light cursor-pointer ${filter === "everyone" ? "segment-light-active" : ""}`}
            >
              Everyone
            </button>
          </div>
          <p className="text-[11px] text-ink-faint tabular-nums">
            {entries.length} {entries.length === 1 ? "player" : "players"}
            {filter === "everyone" && (
              <span> · $ marks who is in the prize pool</span>
            )}
          </p>
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

    </div>
  );
}
