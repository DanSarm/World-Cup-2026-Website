"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LeaderboardEntry } from "@/lib/types";
import { filterLeaderboard, type LeaderboardFilter } from "@/lib/leaderboardFilter";
import { formatMoney } from "@/lib/payouts";
import { mergeLeaderboard, useLiveRefresh } from "@/lib/hooks/useLiveRefresh";
import { PlayerPodiumFlags } from "./PlayerPodiumFlags";
import { RecentPickFormDots } from "./RecentPickFormDots";
import { RankMedal } from "./PlaceMedal";

interface HomeTopFiveProps {
  initialEntries: LeaderboardEntry[];
  prizePool: number;
  /** Poll for live score updates only while a match may be in play. */
  pollLive?: boolean;
  /** SSR hint before the first live poll returns. */
  initialHasLiveScoring?: boolean;
}

export function HomeTopFive({
  initialEntries,
  prizePool,
  pollLive = false,
  initialHasLiveScoring = false,
}: HomeTopFiveProps) {
  const [filter, setFilter] = useState<LeaderboardFilter>("paid");
  const { data } = useLiveRefresh(pollLive);

  const hasLive = data?.hasLiveScoring ?? initialHasLiveScoring;
  const leaderboard = useMemo(
    () => mergeLeaderboard(initialEntries, data?.leaderboard),
    [initialEntries, data?.leaderboard]
  );

  const entries = useMemo(
    () => filterLeaderboard(leaderboard, filter, prizePool).slice(0, 5),
    [leaderboard, filter, prizePool]
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="section-title">
          Leaderboard
          <span className="ml-2 text-xs font-semibold text-ink-faint align-middle">
            Top 5
          </span>
          {hasLive && (
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-canada align-middle">
              · Live
            </span>
          )}
        </h2>
        <Link
          href="/leaderboard"
          className="text-xs font-semibold text-gold-light hover:text-gold transition-colors"
        >
          See all →
        </Link>
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-ink/5">
          <div className="segmented-light">
            <button
              type="button"
              onClick={() => setFilter("paid")}
              className={`segment-light ${filter === "paid" ? "segment-light-active" : ""}`}
            >
              Paid only
            </button>
            <button
              type="button"
              onClick={() => setFilter("everyone")}
              className={`segment-light ${filter === "everyone" ? "segment-light-active" : ""}`}
            >
              Everyone
            </button>
          </div>
        </div>

        {entries.map((entry) => {
          const displayPoints =
            hasLive && entry.provisionalTotalPoints != null
              ? entry.provisionalTotalPoints
              : entry.totalPoints;

          return (
            <div key={entry.playerId} className="lb-row lb-row--compact">
              <span className="lb-row-rank">
                {entry.rank <= 3 ? (
                  <RankMedal rank={entry.rank} trophySize="compact" />
                ) : (
                  entry.rank
                )}
              </span>
              <span className="lb-row-main">
                <PlayerPodiumFlags
                  picks={entry.podiumPicks}
                  fallbackEmoji={entry.avatarEmoji}
                  size="xs"
                  className="lb-entry-flags !w-auto"
                />
                <span className="lb-entry-name-text">{entry.displayName}</span>
              </span>
              <RecentPickFormDots
                form={entry.recentForm ?? []}
                className="lb-entry-form"
              />
              <span className="lb-row-score">
                {displayPoints}
                <span className="text-xs font-normal text-ink-faint ml-0.5">
                  pts
                </span>
                {hasLive && (entry.livePoints ?? 0) > 0 && (
                  <span className="block text-[10px] font-medium text-mexico">
                    +{entry.livePoints} live
                  </span>
                )}
                {filter === "paid" &&
                  entry.rank <= 4 &&
                  entry.projectedPrize > 0 && (
                    <span className="block text-[11px] font-bold text-mexico mt-0.5">
                      {formatMoney(entry.projectedPrize)}
                    </span>
                  )}
              </span>
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="text-center text-ink-faint py-6 text-sm">
            {filter === "paid" ? "No paid players yet" : "No players yet"}
          </p>
        )}
      </div>
    </section>
  );
}
