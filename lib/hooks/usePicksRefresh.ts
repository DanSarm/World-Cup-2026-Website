"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunityMatchPick } from "@/lib/data";
import type { Match, MatchPrediction } from "@/lib/types";

const PICKS_POLL_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_PICKS_POLL_INTERVAL_MS ?? "45000"
);

export interface PicksSnapshotPayload {
  syncedAt: string;
  matches: Match[];
  predictions: MatchPrediction[];
  communityPicksByMatchId: Record<string, CommunityMatchPick[]>;
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

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    void refresh();
    const id = window.setInterval(() => void refresh(), PICKS_POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, refresh]);

  return { data, loading, refresh };
}
