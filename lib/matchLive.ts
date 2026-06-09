import { parseISO } from "date-fns";
import type { Match } from "./types";

/** Typical match length + stoppage (hours). */
const IN_PLAY_HOURS = 2.5;

/** Match currently in progress with a live score. */
export function isMatchLive(match: Match): boolean {
  return (
    match.status === "live" &&
    match.home_score !== null &&
    match.away_score !== null
  );
}

/** Featured match for the home page: live first, else next pickable. */
export function findLiveMatch(matches: Match[]): Match | null {
  const live = matches
    .filter(isMatchLive)
    .sort(
      (a, b) =>
        (b.live_updated_at ?? b.kickoff_at ?? "").localeCompare(
          a.live_updated_at ?? a.kickoff_at ?? ""
        )
    );
  return live[0] ?? null;
}

export function hasAnyLiveMatch(matches: Match[]): boolean {
  return matches.some(isMatchLive);
}

/** Kickoff passed, within match window, not final — may be live or awaiting sync. */
export function isMatchInPlayWindow(match: Match): boolean {
  if (match.status === "final") return false;
  if (match.status === "live") return true;
  if (!match.kickoff_at || !match.home_team_id) return false;

  const kickoff = parseISO(match.kickoff_at).getTime();
  const now = Date.now();
  const end = kickoff + IN_PLAY_HOURS * 60 * 60 * 1000;
  return now >= kickoff && now <= end;
}

export function isAnyMatchInPlayWindow(matches: Match[]): boolean {
  return matches.some(isMatchInPlayWindow);
}

/** Only call The Odds API scores when a game may actually be live. */
export function shouldSyncLiveScoresFromApi(matches: Match[]): boolean {
  return isAnyMatchInPlayWindow(matches);
}

/** Apply live score/status updates onto a full match list. */
export function mergeMatchScoreUpdates(
  base: Match[],
  updates: Array<
    Pick<
      Match,
      | "id"
      | "status"
      | "home_score"
      | "away_score"
      | "winner_team_id"
      | "live_updated_at"
    >
  >
): Match[] {
  if (!updates.length) return base;
  const byId = new Map(updates.map((u) => [u.id, u]));
  return base.map((match) => {
    const update = byId.get(match.id);
    if (!update) return match;
    return {
      ...match,
      status: update.status,
      home_score: update.home_score,
      away_score: update.away_score,
      winner_team_id: update.winner_team_id ?? match.winner_team_id,
      live_updated_at: update.live_updated_at ?? match.live_updated_at,
    };
  });
}
