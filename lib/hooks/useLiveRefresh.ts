"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeaderboardEntry, Match, PickFormSlot } from "@/lib/types";
import { assignCompetitionRanksImmutable } from "@/lib/competitionRank";

const POLL_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS ?? "600000"
);

export interface LiveApiPayload {
  syncedAt: string;
  syncSkipped: string | null;
  hasLiveScoring: boolean;
  liveMatch: Pick<
    Match,
    | "id"
    | "status"
    | "home_score"
    | "away_score"
    | "winner_team_id"
    | "live_updated_at"
    | "kickoff_at"
    | "stage"
    | "group_letter"
    | "home_team_id"
    | "away_team_id"
  > | null;
  leaderboard: LeaderboardEntry[];
  matches: Pick<
    Match,
    | "id"
    | "status"
    | "home_score"
    | "away_score"
    | "winner_team_id"
    | "live_updated_at"
  >[];
}

export function useLiveRefresh(enabled: boolean) {
  const [data, setData] = useState<LiveApiPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as LiveApiPayload;
      if (mountedRef.current) setData(json);
    } catch {
      /* ignore transient network errors */
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [enabled, refresh]);

  return { data, loading, refresh };
}

export function mergeLiveMatch(
  base: Match,
  live?: Pick<
    Match,
    | "id"
    | "status"
    | "home_score"
    | "away_score"
    | "winner_team_id"
    | "live_updated_at"
  > | null
): Match {
  if (!live || live.id !== base.id) return base;
  return {
    ...base,
    status: live.status,
    home_score: live.home_score,
    away_score: live.away_score,
    winner_team_id: live.winner_team_id,
    live_updated_at: live.live_updated_at,
  };
}

export function mergeLiveMatchFromPayload(
  base: Match,
  payload: Pick<LiveApiPayload, "liveMatch" | "matches"> | null | undefined
): Match {
  if (!payload) return base;
  const update =
    payload.liveMatch?.id === base.id
      ? payload.liveMatch
      : payload.matches.find((m) => m.id === base.id);
  return mergeLiveMatch(base, update);
}

export function mergeLeaderboard(
  base: LeaderboardEntry[],
  live?: LeaderboardEntry[] | null
): LeaderboardEntry[] {
  if (!live?.length) return base.map((entry) => ({ ...entry }));

  const byId = new Map(live.map((e) => [e.playerId, e]));
  const merged = base.map((entry) => {
    const updated = byId.get(entry.playerId);
    if (!updated) return { ...entry };
    return {
      ...entry,
      paid: updated.paid ?? entry.paid,
      totalPoints: Math.max(entry.totalPoints, updated.totalPoints),
      provisionalTotalPoints:
        updated.provisionalTotalPoints ?? entry.provisionalTotalPoints,
      livePoints: updated.livePoints ?? entry.livePoints,
      recentForm: (updated.recentForm ?? entry.recentForm) as
        | PickFormSlot[]
        | undefined,
    };
  });

  const sorted = [...merged].sort((a, b) => {
    const aPts = a.provisionalTotalPoints ?? a.totalPoints;
    const bPts = b.provisionalTotalPoints ?? b.totalPoints;
    return bPts - aPts || a.displayName.localeCompare(b.displayName);
  });
  return assignCompetitionRanksImmutable(
    sorted,
    (e) => e.provisionalTotalPoints ?? e.totalPoints
  );
}
