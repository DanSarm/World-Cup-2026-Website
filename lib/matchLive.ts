import { parseISO } from "date-fns";
import type { Match } from "./types";
import { isKnockoutStage } from "./types";

/** Group stage: 90 min + stoppage. Knockout: extra time + penalties buffer. */
const GROUP_IN_PLAY_HOURS = 2.5;
const KNOCKOUT_IN_PLAY_HOURS = 4.5;
/** Legacy name kept so stale dev bundles don't throw ReferenceError after hot reload. */
const IN_PLAY_HOURS = GROUP_IN_PLAY_HOURS;

function inPlayHoursForMatch(match: { stage?: Match["stage"] }): number {
  return match.stage && isKnockoutStage(match.stage)
    ? KNOCKOUT_IN_PLAY_HOURS
    : GROUP_IN_PLAY_HOURS;
}

/** Match currently in progress with a live score. */
export function isMatchLive(match: LiveScoreFields): boolean {
  return hasDisplayableLiveScore(match);
}

type LiveScoreFields = Pick<
  Match,
  "status" | "home_score" | "away_score" | "kickoff_at" | "home_team_id"
> & {
  stage?: Match["stage"];
};

/** On the field now — live sync or within the kickoff window (not final). */
export function isMatchCurrentlyPlaying(match: LiveScoreFields): boolean {
  if (match.status === "final") return false;
  if (match.status === "live") return true;
  return isMatchInPlayWindow(match);
}

/** DB has a score we can show while the match is in progress. */
export function hasDisplayableLiveScore(match: LiveScoreFields): boolean {
  return (
    match.home_score !== null &&
    match.away_score !== null &&
    isMatchCurrentlyPlaying(match)
  );
}

/** All matches currently in play, earliest kickoff first. */
export function findCurrentlyPlayingMatches(matches: Match[]): Match[] {
  return matches
    .filter(isMatchCurrentlyPlaying)
    .sort((a, b) =>
      (a.kickoff_at ?? "9999").localeCompare(b.kickoff_at ?? "9999")
    );
}

/** Featured match for the home page: first currently playing, if any. */
export function findLiveMatch(matches: Match[]): Match | null {
  return findCurrentlyPlayingMatches(matches)[0] ?? null;
}

export function hasAnyLiveMatch(matches: Match[]): boolean {
  return matches.some(isMatchLive);
}

export function hasAnyDisplayableLiveScore(matches: Match[]): boolean {
  return matches.some(hasDisplayableLiveScore);
}

/** Kickoff passed, within match window, not final — may be live or awaiting sync. */
export function isMatchInPlayWindow(match: LiveScoreFields): boolean {
  if (match.status === "final") return false;
  if (match.status === "live") return true;
  if (!match.kickoff_at || !match.home_team_id) return false;

  const kickoff = parseISO(match.kickoff_at).getTime();
  const now = Date.now();
  const end = kickoff + inPlayHoursForMatch(match) * 60 * 60 * 1000;
  return now >= kickoff && now <= end;
}

/** Hours after kickoff to keep polling external score APIs (covers late sync + FT). */
export const SCORE_SYNC_HOURS = 6;

/** Non-final match that should still receive ESPN / Odds API score updates. */
export function matchNeedsScoreSync(
  match: Pick<
    Match,
    "status" | "kickoff_at" | "home_score" | "away_score" | "home_team_id"
  > & { stage?: Match["stage"] }
): boolean {
  if (match.status === "final") return false;
  if (!match.kickoff_at || !match.home_team_id) return false;
  if (match.status === "live") return true;
  if (isMatchInPlayWindow(match)) return true;

  const kickoff = parseISO(match.kickoff_at).getTime();
  const now = Date.now();
  return now >= kickoff && now - kickoff <= SCORE_SYNC_HOURS * 60 * 60 * 1000;
}

export function isAnyMatchNeedingScoreSync(
  matches: (Pick<
    Match,
    "status" | "kickoff_at" | "home_score" | "away_score" | "home_team_id"
  > & { stage?: Match["stage"] })[]
): boolean {
  return matches.some(matchNeedsScoreSync);
}

/**
 * Match has a result we should score as final — includes API "locked" rows
 * after the in-play window when scores are set (common when sync missed finalize).
 */
export function isMatchDecidedForScoring(
  match: LiveScoreFields
): boolean {
  if (match.status === "final") return true;
  if (match.home_score === null || match.away_score === null) return false;
  if (!match.kickoff_at || !match.home_team_id) return false;

  const kickoff = parseISO(match.kickoff_at).getTime();
  if (Date.now() < kickoff) return false;

  if (match.status === "locked" && !isMatchInPlayWindow(match)) {
    return true;
  }

  return false;
}

export function shouldAutoFinalizeMatch(match: LiveScoreFields): boolean {
  return match.status === "locked" && isMatchDecidedForScoring(match);
}

export function isAnyMatchInPlayWindow(matches: Match[]): boolean {
  return matches.some(isMatchInPlayWindow);
}

/** Only call The Odds API scores when a game may actually be live. */
export function shouldSyncLiveScoresFromApi(matches: Match[]): boolean {
  return isAnyMatchNeedingScoreSync(matches);
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
