import { unstable_cache } from "next/cache";
import { getSupabase } from "@/lib/supabaseServer";
import type { Team } from "@/lib/types";
import { isOddsApiConfigured } from "./config";
import { getStoredCreditsRemaining } from "./quotaGuard";
import { average, decimalToImplied } from "./math";
import { processPolymarketWinnerMarkets } from "./polymarketChampionOdds";
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

export type ChampionOddsSource =
  | "odds_api"
  | "polymarket"
  | "stored"
  | "none";

export interface ChampionOddsResult {
  rows: ChampionOddsRow[];
  source: ChampionOddsSource;
  sourceLabel: string;
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

function entriesFromStoredProbabilities(
  teams: Team[],
  probabilities: Record<string, number> | undefined
): ChampionOddsEntry[] {
  if (!probabilities) return [];

  return Object.entries(probabilities)
    .map(([teamId, impliedProbability]) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team || impliedProbability <= 0) return null;
      return { team, impliedProbability };
    })
    .filter((row): row is ChampionOddsEntry => row !== null)
    .sort((a, b) => b.impliedProbability - a.impliedProbability);
}

type PolymarketEvent = {
  title?: string;
  markets?: Array<{
    question?: string;
    outcomes?: string;
    outcomePrices?: string;
  }>;
};

async function loadPolymarketWinnerEvent(): Promise<PolymarketEvent> {
  const res = await fetch(
    "https://gamma-api.polymarket.com/events/slug/world-cup-winner",
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) {
    throw new Error(`Polymarket winner odds error ${res.status}`);
  }
  return res.json() as Promise<PolymarketEvent>;
}

const getCachedPolymarketWinnerEvent = unstable_cache(
  loadPolymarketWinnerEvent,
  ["world-cup-winner-polymarket-event"],
  { revalidate: 3600 }
);

async function fetchPolymarketWinnerEvent(): Promise<PolymarketEvent> {
  try {
    return await getCachedPolymarketWinnerEvent();
  } catch {
    return loadPolymarketWinnerEvent();
  }
}

async function fetchPolymarketWinnerEntries(
  teams: Team[]
): Promise<ChampionOddsEntry[]> {
  try {
    const event = await fetchPolymarketWinnerEvent();
    return processPolymarketWinnerMarkets(event, teams);
  } catch (error) {
    console.error("fetchPolymarketWorldCupWinnerOdds:", error);
    return [];
  }
}

async function fetchOddsApiWinnerEntries(
  teams: Team[]
): Promise<ChampionOddsEntry[]> {
  if (!isOddsApiConfigured()) return [];

  const remaining = await getStoredCreditsRemaining();
  if (remaining != null && remaining <= 0) return [];

  try {
    const events = await fetchWorldCupWinnerOdds();
    return processWorldCupWinnerOdds(events, teams);
  } catch (error) {
    console.error("fetchWorldCupWinnerOdds:", error);
    return [];
  }
}

export async function persistChampionProbabilities(
  ranked: ChampionOddsEntry[]
): Promise<void> {
  if (ranked.length === 0) return;

  const value = Object.fromEntries(
    ranked.map((entry) => [entry.team.id, entry.impliedProbability])
  );
  const supabase = getSupabase();
  const now = new Date().toISOString();

  await supabase.from("settings").upsert([
    { key: "champion_probabilities", value, updated_at: now },
    { key: "champion_odds_updated_at", value: now, updated_at: now },
  ]);
}

function buildAllTeamChampionOdds(
  teams: Team[],
  ranked: ChampionOddsEntry[]
): ChampionOddsRow[] {
  const probMap = new Map<string, number>();
  for (const entry of ranked) {
    probMap.set(entry.team.id, entry.impliedProbability);
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

function sourceLabel(source: ChampionOddsSource): string {
  switch (source) {
    case "odds_api":
      return "sportsbook win %";
    case "polymarket":
      return "Polymarket win %";
    case "stored":
      return "saved market win %";
    default:
      return "Winner odds from the market";
  }
}

async function resolveChampionEntries(
  teams: Team[],
  storedProbabilities?: Record<string, number>
): Promise<{ ranked: ChampionOddsEntry[]; source: ChampionOddsSource }> {
  const fromOddsApi = await fetchOddsApiWinnerEntries(teams);
  if (fromOddsApi.length > 0) {
    await persistChampionProbabilities(fromOddsApi);
    return { ranked: fromOddsApi, source: "odds_api" };
  }

  const fromPolymarket = await fetchPolymarketWinnerEntries(teams);
  if (fromPolymarket.length > 0) {
    await persistChampionProbabilities(fromPolymarket);
    return { ranked: fromPolymarket, source: "polymarket" };
  }

  const fromStored = entriesFromStoredProbabilities(teams, storedProbabilities);
  if (fromStored.length > 0) {
    return { ranked: fromStored, source: "stored" };
  }

  return { ranked: [], source: "none" };
}

export async function getAllChampionOdds(
  teams: Team[],
  storedProbabilities?: Record<string, number>
): Promise<ChampionOddsResult> {
  const { ranked, source } = await resolveChampionEntries(
    teams,
    storedProbabilities
  );

  return {
    rows: buildAllTeamChampionOdds(teams, ranked),
    source,
    sourceLabel: sourceLabel(source),
  };
}

export async function getTopChampionOdds(
  teams: Team[],
  limit = 5,
  storedProbabilities?: Record<string, number>
): Promise<ChampionOddsEntry[]> {
  const { ranked } = await resolveChampionEntries(teams, storedProbabilities);
  return ranked.slice(0, limit);
}

/** Manual refresh — uses Polymarket when Odds API quota is exhausted. */
export async function syncChampionOdds(teams: Team[]): Promise<{
  source: ChampionOddsSource;
  teamCount: number;
}> {
  const { ranked, source } = await resolveChampionEntries(teams);
  return { source, teamCount: ranked.length };
}
