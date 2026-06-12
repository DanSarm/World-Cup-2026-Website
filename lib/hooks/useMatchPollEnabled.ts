"use client";

import { useEffect, useState } from "react";
import type { Match } from "@/lib/types";
import { isAnyMatchInPlayWindow, isMatchInPlayWindow, isMatchLive } from "@/lib/matchLive";

/** Re-check every 15s so polling starts when kickoff passes without a page reload. */
const RECHECK_MS = 15_000;

function matchMayNeedLivePoll(match: Pick<Match, "status" | "kickoff_at" | "home_score" | "away_score" | "home_team_id">): boolean {
  return isMatchLive(match) || isMatchInPlayWindow(match);
}

/** True when any match may be live — for leaderboard / home polling. */
export function useAnyMatchPollEnabled(
  matches: Pick<Match, "status" | "kickoff_at" | "home_score" | "away_score" | "home_team_id">[]
): boolean {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, RECHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  return matches.some((m) => matchMayNeedLivePoll(m));
}

/** True when this featured match may be live — for home match cards. */
export function useMatchPollEnabled(
  match: Pick<Match, "status" | "kickoff_at" | "home_score" | "away_score" | "home_team_id">
): boolean {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, RECHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  return matchMayNeedLivePoll(match);
}
