import { addDays, format, parseISO } from "date-fns";
import type { Match } from "@/lib/types";
import { teamNameMatches } from "@/lib/odds/teamAliases";
import { isMatchInPlayWindow } from "@/lib/matchLive";

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
}

interface EspnCompetitor {
  homeAway?: "home" | "away";
  score?: string;
  team?: { displayName?: string; abbreviation?: string };
}

interface EspnScoreboardResponse {
  events?: Array<{
    id: string;
    competitions?: Array<{
      competitors?: EspnCompetitor[];
      status?: {
        type?: {
          state?: string;
          completed?: boolean;
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

  return {
    id: raw.id,
    homeTeam: home.team.displayName,
    awayTeam: away.team.displayName,
    homeScore,
    awayScore,
    completed,
    inProgress: state === "in",
  };
}

/** YYYYMMDD keys for ESPN scoreboard queries around in-play fixtures. */
export function scoreboardDatesForMatches(matches: Match[]): string[] {
  const dates = new Set<string>();
  const now = Date.now();
  const sixHoursMs = 6 * 60 * 60 * 1000;

  for (const match of matches) {
    if (!match.kickoff_at) continue;
    const inWindow = isMatchInPlayWindow(match);
    const kickoff = parseISO(match.kickoff_at);
    const recentlyEnded =
      match.status !== "final" &&
      now >= kickoff.getTime() &&
      now - kickoff.getTime() <= sixHoursMs;

    if (!inWindow && !recentlyEnded) continue;

    dates.add(format(kickoff, "yyyyMMdd"));
    dates.add(format(addDays(kickoff, -1), "yyyyMMdd"));
    dates.add(format(addDays(kickoff, 1), "yyyyMMdd"));
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
