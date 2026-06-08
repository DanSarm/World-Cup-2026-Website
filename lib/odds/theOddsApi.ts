/**
 * The Odds API client for match odds.
 * Polymarket can be added later for futures/champion probabilities,
 * but The Odds API is better for simple match odds.
 */

import type { Match, Team } from "@/lib/types";
import { isKnockoutStage } from "@/lib/types";
import { getOddsConfig, isOddsApiConfigured } from "./config";
import {
  average,
  calculateNoVigProbabilities,
  decimalToAmerican,
  decimalToImplied,
  probabilityToBonus,
} from "./math";
import { teamNameMatches } from "./teamAliases";

export { calculateNoVigProbabilities, probabilityToBonus } from "./math";

export interface OddsApiOutcome {
  name: string;
  price: number;
}

export interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface OddsSnapshotRow {
  match_id: string;
  provider: string;
  source_event_id: string;
  bookmaker_key: string;
  bookmaker_title: string;
  market_key: string;
  outcome_name: string;
  outcome_type: "home" | "draw" | "away" | "home_advance" | "away_advance";
  decimal_price: number;
  american_price: number;
  raw_implied_probability: number;
  normalized_probability: number;
}

export interface ProcessedH2hOdds {
  homeImplied: number;
  drawImplied: number;
  awayImplied: number;
  homeBonus: number;
  drawBonus: number;
  awayBonus: number;
  bookmakerCount: number;
  bookmakerTitles: string[];
  snapshots: OddsSnapshotRow[];
}

export interface ProcessedAdvanceOdds {
  homeAdvanceImplied: number;
  awayAdvanceImplied: number;
  homeAdvanceBonus: number;
  awayAdvanceBonus: number;
  bookmakerCount: number;
  snapshots: OddsSnapshotRow[];
}

export interface MatchOddsMatchResult {
  event: OddsApiEvent | null;
  confidence: number;
  suggestions: OddsApiEvent[];
  warning?: string;
}

const ADVANCE_MARKET_KEYS = ["to_advance", "to_qualify", "qualify", "advance"];

export async function fetchUpcomingOdds(): Promise<OddsApiEvent[]> {
  const config = getOddsConfig();
  if (!config.apiKey) {
    throw new Error("ODDS_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    apiKey: config.apiKey,
    regions: config.regions,
    markets: config.markets,
    oddsFormat: config.oddsFormat,
  });

  const url = `https://api.the-odds-api.com/v4/sports/${config.sportKey}/odds/?${params}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Odds API error ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as OddsApiEvent[];
}

function hoursDiff(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3600000;
}

function scoreEventAgainstFixture(
  event: OddsApiEvent,
  homeTeam: Pick<Team, "name" | "short_name" | "fifa_code"> | null,
  awayTeam: Pick<Team, "name" | "short_name" | "fifa_code"> | null,
  kickoffAt: string | null
): number {
  if (!homeTeam || !awayTeam) return 0;

  let score = 0;
  const homeMatch =
    teamNameMatches(event.home_team, homeTeam) &&
    teamNameMatches(event.away_team, awayTeam);
  const swapped =
    teamNameMatches(event.home_team, awayTeam) &&
    teamNameMatches(event.away_team, homeTeam);

  if (homeMatch) score += 60;
  else if (swapped) score += 20;
  else {
    if (teamNameMatches(event.home_team, homeTeam)) score += 15;
    if (teamNameMatches(event.away_team, awayTeam)) score += 15;
  }

  if (kickoffAt) {
    const diff = hoursDiff(event.commence_time, kickoffAt);
    if (diff <= 2) score += 30;
    else if (diff <= 6) score += 20;
    else if (diff <= 24) score += 10;
  }

  return Math.min(score, 100);
}

/** Match an odds event to a fixture by team names and kickoff time. */
export function matchOddsEventToFixture(
  events: OddsApiEvent[],
  match: Pick<
    Match,
    "kickoff_at" | "home_label" | "away_label" | "odds_event_id"
  > & {
    home_team?: Team | null;
    away_team?: Team | null;
  },
  linkedEventId?: string | null
): MatchOddsMatchResult {
  if (linkedEventId) {
    const linked = events.find((e) => e.id === linkedEventId);
    if (linked) {
      return { event: linked, confidence: 100, suggestions: [linked] };
    }
    return {
      event: null,
      confidence: 0,
      suggestions: [],
      warning: "Linked odds event not found in latest feed.",
    };
  }

  const scored = events
    .map((event) => ({
      event,
      confidence: scoreEventAgainstFixture(
        event,
        match.home_team ?? null,
        match.away_team ?? null,
        match.kickoff_at
      ),
    }))
    .filter((s) => s.confidence >= 20)
    .sort((a, b) => b.confidence - a.confidence);

  const suggestions = scored.slice(0, 5).map((s) => s.event);
  const best = scored[0];

  if (!best || best.confidence < 70) {
    return {
      event: null,
      confidence: best?.confidence ?? 0,
      suggestions,
      warning: "Could not match odds. Choose event manually.",
    };
  }

  return {
    event: best.event,
    confidence: best.confidence,
    suggestions,
  };
}

function findH2hMarket(bookmaker: OddsApiBookmaker): OddsApiMarket | undefined {
  return bookmaker.markets.find((m) => m.key === "h2h");
}

function classifyOutcome(
  name: string,
  homeTeam: Team,
  awayTeam: Team
): "home" | "draw" | "away" | null {
  const lower = name.toLowerCase().trim();
  if (lower === "draw" || lower === "tie") return "draw";
  if (teamNameMatches(name, homeTeam)) return "home";
  if (teamNameMatches(name, awayTeam)) return "away";
  return null;
}

/** Process h2h 3-way odds from a matched event. */
export function processH2hOdds(
  event: OddsApiEvent,
  matchId: string,
  homeTeam: Team,
  awayTeam: Team,
  provider: string
): ProcessedH2hOdds {
  const homeNoVigs: number[] = [];
  const drawNoVigs: number[] = [];
  const awayNoVigs: number[] = [];
  const snapshots: OddsSnapshotRow[] = [];
  const bookmakerTitles: string[] = [];

  for (const bookmaker of event.bookmakers ?? []) {
    const market = findH2hMarket(bookmaker);
    if (!market?.outcomes?.length) continue;

    let homePrice: number | null = null;
    let drawPrice: number | null = null;
    let awayPrice: number | null = null;

    for (const outcome of market.outcomes) {
      const kind = classifyOutcome(outcome.name, homeTeam, awayTeam);
      if (kind === "home") homePrice = outcome.price;
      else if (kind === "draw") drawPrice = outcome.price;
      else if (kind === "away") awayPrice = outcome.price;
    }

    if (!homePrice || !drawPrice || !awayPrice) continue;

    const homeRaw = decimalToImplied(homePrice);
    const drawRaw = decimalToImplied(drawPrice);
    const awayRaw = decimalToImplied(awayPrice);
    const noVig = calculateNoVigProbabilities({
      home: homeRaw,
      draw: drawRaw,
      away: awayRaw,
    });

    homeNoVigs.push(noVig.home);
    drawNoVigs.push(noVig.draw);
    awayNoVigs.push(noVig.away);
    bookmakerTitles.push(bookmaker.title);

    const rows: Array<{
      type: "home" | "draw" | "away";
      name: string;
      price: number;
      raw: number;
      norm: number;
    }> = [
      { type: "home", name: event.home_team, price: homePrice, raw: homeRaw, norm: noVig.home },
      { type: "draw", name: "Draw", price: drawPrice, raw: drawRaw, norm: noVig.draw },
      { type: "away", name: event.away_team, price: awayPrice, raw: awayRaw, norm: noVig.away },
    ];

    for (const row of rows) {
      snapshots.push({
        match_id: matchId,
        provider,
        source_event_id: event.id,
        bookmaker_key: bookmaker.key,
        bookmaker_title: bookmaker.title,
        market_key: "h2h",
        outcome_name: row.name,
        outcome_type: row.type,
        decimal_price: row.price,
        american_price: decimalToAmerican(row.price),
        raw_implied_probability: row.raw,
        normalized_probability: row.norm,
      });
    }
  }

  const homeImplied = average(homeNoVigs);
  const drawImplied = average(drawNoVigs);
  const awayImplied = average(awayNoVigs);

  return {
    homeImplied,
    drawImplied,
    awayImplied,
    homeBonus: probabilityToBonus(homeImplied),
    drawBonus: probabilityToBonus(drawImplied),
    awayBonus: probabilityToBonus(awayImplied),
    bookmakerCount: homeNoVigs.length,
    bookmakerTitles,
    snapshots,
  };
}

function isAdvanceMarket(key: string): boolean {
  const lower = key.toLowerCase();
  return ADVANCE_MARKET_KEYS.some((k) => lower.includes(k));
}

/** Process knockout advance markets when available. */
export function processAdvanceOdds(
  event: OddsApiEvent,
  matchId: string,
  homeTeam: Team,
  awayTeam: Team,
  provider: string
): ProcessedAdvanceOdds | null {
  const homeNoVigs: number[] = [];
  const awayNoVigs: number[] = [];
  const snapshots: OddsSnapshotRow[] = [];

  for (const bookmaker of event.bookmakers ?? []) {
    for (const market of bookmaker.markets ?? []) {
      if (!isAdvanceMarket(market.key)) continue;
      if (market.outcomes.length !== 2) continue;

      let homePrice: number | null = null;
      let awayPrice: number | null = null;

      for (const outcome of market.outcomes) {
        if (teamNameMatches(outcome.name, homeTeam)) homePrice = outcome.price;
        else if (teamNameMatches(outcome.name, awayTeam)) awayPrice = outcome.price;
      }

      if (!homePrice || !awayPrice) continue;

      const homeRaw = decimalToImplied(homePrice);
      const awayRaw = decimalToImplied(awayPrice);
      const noVig = calculateNoVigProbabilities({ home: homeRaw, away: awayRaw });

      homeNoVigs.push(noVig.home);
      awayNoVigs.push(noVig.away);

      for (const row of [
        { type: "home_advance" as const, name: homeTeam.name, price: homePrice, raw: homeRaw, norm: noVig.home },
        { type: "away_advance" as const, name: awayTeam.name, price: awayPrice, raw: awayRaw, norm: noVig.away },
      ]) {
        snapshots.push({
          match_id: matchId,
          provider,
          source_event_id: event.id,
          bookmaker_key: bookmaker.key,
          bookmaker_title: bookmaker.title,
          market_key: market.key,
          outcome_name: row.name,
          outcome_type: row.type,
          decimal_price: row.price,
          american_price: decimalToAmerican(row.price),
          raw_implied_probability: row.raw,
          normalized_probability: row.norm,
        });
      }
    }
  }

  if (!homeNoVigs.length) return null;

  const homeAdvanceImplied = average(homeNoVigs);
  const awayAdvanceImplied = average(awayNoVigs);

  return {
    homeAdvanceImplied,
    awayAdvanceImplied,
    homeAdvanceBonus: probabilityToBonus(homeAdvanceImplied),
    awayAdvanceBonus: probabilityToBonus(awayAdvanceImplied),
    bookmakerCount: homeNoVigs.length,
    snapshots,
  };
}

export function isOddsConfigured(): boolean {
  return isOddsApiConfigured();
}

export type { Match };

export function isGroupStageMatch(stage: Match["stage"]): boolean {
  return stage === "group";
}

export function shouldUseH2h(stage: Match["stage"]): boolean {
  return !isKnockoutStage(stage);
}
