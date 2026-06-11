"use client";

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
        <span className="block text-[9px] leading-none mt-0.5 text-mexico-light" aria-label="Moved up">
          ▲
        </span>
      );
    }
    if (movement === "down") {
      return (
        <span className="block text-[9px] leading-none mt-0.5 text-canada" aria-label="Moved down">
          ▼
        </span>
      );
    }
    return (
      <span className="block text-[9px] leading-none mt-0.5 text-ink/20" aria-label="No change">
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
      <li
        key={entry.playerId}
        className={`lb-entry ${podiumClass(entry.rank)}`}
      >
        <span
          className={`lb-entry-rank ${
            entry.rank <= 3 ? "lb-entry-rank--medal" : ""
          }`}
        >
          <span className="block">{rankDisplay(entry.rank)}</span>
          {movementDisplay(entry.rankMovement)}
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
          </p>
        </div>

        <RecentPickFormDots
          form={entry.recentForm ?? []}
          className="lb-entry-form"
        />

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
          <p className="text-xs font-semibold text-canada leading-snug">
            <span className="sm:hidden">Live — totals include provisional points</span>
            <span className="hidden sm:inline">
              Live match in progress — totals include provisional points from the
              current score
            </span>
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

    </div>
  );
}
