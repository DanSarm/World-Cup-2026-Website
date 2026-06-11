import type { Match } from "@/lib/types";
import { teamNameMatches } from "@/lib/odds/teamAliases";
import { getOddsConfig, isOddsApiConfigured } from "@/lib/odds/config";

export interface OddsApiScoreEntry {
  name: string;
  score: string;
}

export interface OddsApiScoreEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: OddsApiScoreEntry[] | null;
  last_update?: string;
}

export interface FetchLiveScoresResult {
  events: OddsApiScoreEvent[];
  /** API quota cost for this call (1 live-only, 2 with recent completed). */
  quotaCost: number;
  creditsRemaining: number | null;
}

export async function fetchLiveScores(options?: {
  /** Include completed games from the last day — costs 2 credits instead of 1. */
  includeRecentCompleted?: boolean;
}): Promise<FetchLiveScoresResult> {
  const config = getOddsConfig();
  if (!config.apiKey) {
    throw new Error("ODDS_API_KEY is not configured");
  }

  const includeRecentCompleted = options?.includeRecentCompleted === true;
  const params = new URLSearchParams({
    apiKey: config.apiKey,
    dateFormat: "iso",
  });
  if (includeRecentCompleted) {
    params.set("daysFrom", "1");
  }

  const url = `https://api.the-odds-api.com/v4/sports/${config.sportKey}/scores/?${params}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Scores API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const remainingHeader = res.headers.get("x-requests-remaining");
  const creditsRemaining =
    remainingHeader != null ? Number(remainingHeader) : null;

  return {
    events: (await res.json()) as OddsApiScoreEvent[],
    quotaCost: includeRecentCompleted ? 2 : 1,
    creditsRemaining: Number.isFinite(creditsRemaining ?? NaN)
      ? creditsRemaining
      : null,
  };
}

export function isScoresApiConfigured(): boolean {
  return isOddsApiConfigured();
}

/** Parse home/away integer scores from an Odds API score event. */
export function parseScoreEventScores(
  event: OddsApiScoreEvent,
  match?: Pick<Match, "home_team" | "away_team">
): {
  homeScore: number;
  awayScore: number;
} | null {
  if (!event.scores?.length) return null;

  const homeTeam = match?.home_team;
  const awayTeam = match?.away_team;

  const homeEntry = event.scores.find((s) => {
    if (homeTeam && teamNameMatches(s.name, homeTeam)) return true;
    if (!homeTeam) return s.name === event.home_team;
    return false;
  });
  const awayEntry = event.scores.find((s) => {
    if (awayTeam && teamNameMatches(s.name, awayTeam)) return true;
    if (!awayTeam) return s.name === event.away_team;
    return false;
  });
  if (!homeEntry || !awayEntry) return null;

  const homeScore = Number.parseInt(homeEntry.score, 10);
  const awayScore = Number.parseInt(awayEntry.score, 10);
  if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return null;

  return { homeScore, awayScore };
}

export function isScoreEventLive(event: OddsApiScoreEvent): boolean {
  return !event.completed && parseScoreEventScores(event) != null;
}
