import { addDays, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Match } from "@/lib/types";
import { teamNameMatches } from "@/lib/odds/teamAliases";
import { matchNeedsScoreSync, shouldAutoFinalizeMatch } from "@/lib/matchLive";
import { formatEspnLiveClock } from "@/lib/liveClock";

/** ESPN lists US-hosted fixtures by local calendar day — include UTC + US zones. */
const ESPN_SCOREBOARD_TZS = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
] as const;

const ESPN_WC_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

export interface EspnScoreEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  completed: boolean;
  inProgress: boolean;
  liveClockDisplay: string | null;
  winnerTeamName: string | null;
  decidedByPenalties: boolean;
}

interface EspnCompetitor {
  homeAway?: "home" | "away";
  score?: string;
  winner?: boolean;
  team?: { displayName?: string; abbreviation?: string };
}

interface EspnScoreboardResponse {
  events?: Array<{
    id: string;
    competitions?: Array<{
      competitors?: EspnCompetitor[];
      status?: {
        displayClock?: string;
        period?: number;
        type?: {
          state?: string;
          completed?: boolean;
          name?: string;
          description?: string;
          shortDetail?: string;
        };
      };
    }>;
  }>;
}

function parseEspnEvent(raw: NonNullable<EspnScoreboardResponse["events"]>[number]): EspnScoreEvent | null {
  const competition = raw.competitions?.[0];
  if (!competition) return null;
  const competitors = competition.competitors;
  if (!competitors?.length) return null;

  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team?.displayName || !away?.team?.displayName) return null;

  const homeScore = Number.parseInt(home.score ?? "", 10);
  const awayScore = Number.parseInt(away.score ?? "", 10);
  if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return null;

  const status = competition.status?.type;
  const state = status?.state ?? "pre";
  const completed = status?.completed === true || state === "post";
  const statusName = (status?.name ?? "").toUpperCase();
  const statusDesc = (status?.description ?? "").toLowerCase();
  const winnerCompetitor = competitors.find((c) => c.winner === true);
  const decidedByPenalties =
    statusName.includes("SHOOTOUT") ||
    statusName.includes("PENALT") ||
    statusDesc.includes("penalt") ||
    statusDesc.includes("shootout") ||
    (completed && homeScore === awayScore && !!winnerCompetitor);

  return {
    id: raw.id,
    homeTeam: home.team.displayName,
    awayTeam: away.team.displayName,
    homeScore,
    awayScore,
    completed,
    inProgress: state === "in",
    liveClockDisplay: formatEspnLiveClock(competition.status),
    winnerTeamName: winnerCompetitor?.team?.displayName ?? null,
    decidedByPenalties,
  };
}

/** YYYYMMDD keys for ESPN scoreboard around a kickoff (handles late-night US fixtures). */
export function espnScoreboardDatesForKickoff(kickoffAt: string): string[] {
  const kickoff = parseISO(kickoffAt);
  const dates = new Set<string>();
  for (const tz of ESPN_SCOREBOARD_TZS) {
    for (const offset of [-1, 0, 1] as const) {
      const day = offset === 0 ? kickoff : addDays(kickoff, offset);
      dates.add(formatInTimeZone(day, tz, "yyyyMMdd"));
    }
  }
  return [...dates];
}

/** YYYYMMDD keys for ESPN scoreboard queries around in-play fixtures. */
export function scoreboardDatesForMatches(matches: Match[]): string[] {
  const dates = new Set<string>();
  const now = Date.now();
  const sixHoursMs = 6 * 60 * 60 * 1000;

  for (const match of matches) {
    if (!match.kickoff_at) continue;
    const inWindow = matchNeedsScoreSync(match);
    const needsFinalCheck = shouldAutoFinalizeMatch(match);
    const kickoff = parseISO(match.kickoff_at);
    const recentlyEnded =
      match.status !== "final" &&
      now >= kickoff.getTime() &&
      now - kickoff.getTime() <= sixHoursMs;

    if (!inWindow && !recentlyEnded && !needsFinalCheck) continue;

    for (const d of espnScoreboardDatesForKickoff(match.kickoff_at)) {
      dates.add(d);
    }
  }

  return [...dates].sort();
}

export async function fetchEspnWorldCupEvents(
  dates: string[]
): Promise<EspnScoreEvent[]> {
  if (!dates.length) return [];

  const uniqueDates = [...new Set(dates)];
  const responses = await Promise.all(
    uniqueDates.map(async (date) => {
      const url = `${ESPN_WC_SCOREBOARD}?dates=${date}`;
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return [] as EspnScoreEvent[];
      const json = (await res.json()) as EspnScoreboardResponse;
      return (json.events ?? [])
        .map(parseEspnEvent)
        .filter((e): e is EspnScoreEvent => e != null);
    })
  );

  const byId = new Map<string, EspnScoreEvent>();
  for (const batch of responses) {
    for (const event of batch) {
      byId.set(event.id, event);
    }
  }
  return [...byId.values()];
}

export function matchEspnEventToFixture(
  events: EspnScoreEvent[],
  match: Match
): (EspnScoreEvent & { homeScore: number; awayScore: number }) | null {
  const home = match.home_team;
  const away = match.away_team;
  if (!home || !away) return null;

  const direct = events.find(
    (event) =>
      teamNameMatches(event.homeTeam, home) &&
      teamNameMatches(event.awayTeam, away)
  );
  if (direct) return direct;

  const reversed = events.find(
    (event) =>
      teamNameMatches(event.homeTeam, away) &&
      teamNameMatches(event.awayTeam, home)
  );
  if (!reversed) return null;

  return {
    ...reversed,
    homeScore: reversed.awayScore,
    awayScore: reversed.homeScore,
  };
}

export function espnMinSyncIntervalMs(): number {
  const n = Number(process.env.ESPN_LIVE_SCORES_MIN_INTERVAL_MS ?? "10000");
  return Number.isFinite(n) && n >= 5_000 ? n : 10_000;
}
