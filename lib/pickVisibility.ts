import { parseISO } from "date-fns";
import type { CommunityMatchPick } from "./data";
import {
  isMatchCurrentlyPlaying,
  isMatchDecidedForScoring,
} from "./matchLive";
import type { Match } from "./types";

type MatchRevealFields = Pick<
  Match,
  "status" | "kickoff_at" | "home_team_id" | "home_score" | "away_score"
>;

/** Other players' score picks may be shown once the match is live or finished. */
export function canRevealOtherPlayersPicks(match: MatchRevealFields): boolean {
  if (match.status === "final") return true;
  if (isMatchCurrentlyPlaying(match)) return true;
  if (isMatchDecidedForScoring(match)) return true;

  if (match.kickoff_at && match.home_team_id) {
    const kickoff = parseISO(match.kickoff_at).getTime();
    if (Date.now() >= kickoff) return true;
  }

  return false;
}

/** Strip other players' picks from API payloads before kickoff. Keeps the viewer's own pick. */
export function filterCommunityPicksForViewer(
  picks: CommunityMatchPick[],
  match: MatchRevealFields,
  viewerPlayerId: string
): CommunityMatchPick[] {
  if (canRevealOtherPlayersPicks(match)) return picks;
  return picks.filter((pick) => pick.playerId === viewerPlayerId);
}

export function filterCommunityPicksByMatchForViewer(
  picksByMatchId: Map<string, CommunityMatchPick[]>,
  matches: Match[],
  viewerPlayerId: string
): Record<string, CommunityMatchPick[]> {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const out: Record<string, CommunityMatchPick[]> = {};

  for (const [matchId, picks] of picksByMatchId) {
    const match = matchById.get(matchId);
    out[matchId] = match
      ? filterCommunityPicksForViewer(picks, match, viewerPlayerId)
      : picks;
  }

  return out;
}
