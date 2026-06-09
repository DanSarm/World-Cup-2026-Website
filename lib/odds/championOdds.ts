import { unstable_cache } from "next/cache";
import type { Team } from "@/lib/types";
import { isOddsApiConfigured } from "./config";
import { average, decimalToImplied } from "./math";
import { teamNameMatches } from "./teamAliases";
import {
  fetchWorldCupWinnerOdds,
  type OddsApiEvent,
} from "./theOddsApi";

export interface ChampionOddsEntry {
  team: Team;
  impliedProbability: number;
}

export interface ChampionOddsRow {
  team: Team;
  impliedProbability: number | null;
}

const OUTRIGHT_MARKET_KEYS = new Set(["outrights", "outright", "h2h"]);

function findTeamForOutcome(name: string, teams: Team[]): Team | undefined {
  return teams.find((t) => teamNameMatches(name, t));
}

/** Aggregate no-vig win probabilities from outright markets. */
export function processWorldCupWinnerOdds(
  events: OddsApiEvent[],
  teams: Team[]
): ChampionOddsEntry[] {
  const probsByTeamId = new Map<string, number[]>();

  for (const event of events) {
    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        if (!OUTRIGHT_MARKET_KEYS.has(market.key)) continue;
        if (!market.outcomes?.length) continue;

        const rawImplied = market.outcomes.map((o) => ({
          outcome: o,
          implied: decimalToImplied(o.price),
        }));
        const totalRaw = rawImplied.reduce((sum, row) => sum + row.implied, 0);
        if (totalRaw <= 0) continue;

        for (const row of rawImplied) {
          const team = findTeamForOutcome(row.outcome.name, teams);
          if (!team) continue;
          const noVig = row.implied / totalRaw;
          const bucket = probsByTeamId.get(team.id) ?? [];
          bucket.push(noVig);
          probsByTeamId.set(team.id, bucket);
        }
      }
    }
  }

  return [...probsByTeamId.entries()]
    .map(([teamId, probs]) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return null;
      return {
        team,
        impliedProbability: average(probs),
      };
    })
    .filter((row): row is ChampionOddsEntry => row !== null)
    .sort((a, b) => b.impliedProbability - a.impliedProbability);
}

function topFromStoredProbabilities(
  teams: Team[],
  probabilities: Record<string, number> | undefined,
  limit: number
): ChampionOddsEntry[] {
  if (!probabilities) return [];

  return Object.entries(probabilities)
    .map(([teamId, impliedProbability]) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team || impliedProbability <= 0) return null;
      return { team, impliedProbability };
    })
    .filter((row): row is ChampionOddsEntry => row !== null)
    .sort((a, b) => b.impliedProbability - a.impliedProbability)
    .slice(0, limit);
}

const getCachedWinnerEvents = unstable_cache(
  async (): Promise<OddsApiEvent[]> => {
    if (!isOddsApiConfigured()) return [];
    try {
      return await fetchWorldCupWinnerOdds();
    } catch {
      return [];
    }
  },
  ["world-cup-winner-events"],
  { revalidate: 86400 }
);

function buildAllTeamChampionOdds(
  teams: Team[],
  ranked: ChampionOddsEntry[],
  storedProbabilities?: Record<string, number>
): ChampionOddsRow[] {
  const probMap = new Map<string, number>();

  for (const entry of ranked) {
    probMap.set(entry.team.id, entry.impliedProbability);
  }

  if (ranked.length === 0 && storedProbabilities) {
    for (const [teamId, impliedProbability] of Object.entries(
      storedProbabilities
    )) {
      if (impliedProbability > 0) {
        probMap.set(teamId, impliedProbability);
      }
    }
  }

  return teams
    .map((team) => ({
      team,
      impliedProbability: probMap.get(team.id) ?? null,
    }))
    .sort((a, b) => {
      if (a.impliedProbability != null && b.impliedProbability != null) {
        return b.impliedProbability - a.impliedProbability;
      }
      if (a.impliedProbability != null) return -1;
      if (b.impliedProbability != null) return 1;
      return a.team.fifa_code.localeCompare(b.team.fifa_code);
    });
}

export async function getAllChampionOdds(
  teams: Team[],
  storedProbabilities?: Record<string, number>
): Promise<ChampionOddsRow[]> {
  const events = await getCachedWinnerEvents();
  const ranked = processWorldCupWinnerOdds(events, teams);
  return buildAllTeamChampionOdds(teams, ranked, storedProbabilities);
}

export async function getTopChampionOdds(
  teams: Team[],
  limit = 5,
  storedProbabilities?: Record<string, number>
): Promise<ChampionOddsEntry[]> {
  const events = await getCachedWinnerEvents();
  const ranked = processWorldCupWinnerOdds(events, teams);

  if (ranked.length > 0) {
    return ranked.slice(0, limit);
  }

  return topFromStoredProbabilities(teams, storedProbabilities, limit);
}
