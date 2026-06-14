"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunityMatchPick } from "@/lib/data";
import { isAnyMatchInPlayWindow } from "@/lib/matchLive";
import type { Match, MatchPrediction } from "@/lib/types";

const LIVE_POLL_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS ?? "10000"
);
const IDLE_POLL_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_PICKS_POLL_INTERVAL_MS ?? "45000"
);

export interface PicksSnapshotPayload {
  syncedAt: string;
  matches: Match[];
  predictions: MatchPrediction[];
  communityPicksByMatchId: Record<string, CommunityMatchPick[]>;
  communityPickCountsByMatchId: Record<string, number>;
  totalPlayers: number;
  hasLiveScoring: boolean;
}

export function usePicksRefresh(enabled = true) {
  const [data, setData] = useState<PicksSnapshotPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled || document.visibilityState === "hidden") return;
    setLoading(true);
    try {
      const res = await fetch("/api/picks-snapshot", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as PicksSnapshotPayload;
      if (mountedRef.current) setData(json);
    } catch {
      /* ignore transient network errors */
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled]);

  const liveActive = data ? isAnyMatchInPlayWindow(data.matches) : true;
  const pollIntervalMs = liveActive ? LIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    void refresh();
    const id = window.setInterval(() => void refresh(), pollIntervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, refresh, pollIntervalMs]);

  return { data, loading, refresh };
}
