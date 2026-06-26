import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Match, Team } from "@/lib/types";
import { isKnockoutStage } from "@/lib/types";
import { teamNameMatches } from "./teamAliases";
import {
  calculateNoVigProbabilities,
  groupStageOutcomeBonusesFromImplied,
  probabilityToBonus,
} from "./math";
import { getSupabase } from "@/lib/supabaseServer";

const POLYMARKET_GAMMA = "https://gamma-api.polymarket.com";
const POLYMARKET_ODDS_LAST_SYNC_KEY = "polymarket_odds_last_sync";

const POLYMARKET_CODE_OVERRIDES: Record<string, string> = {
  BIH: "bih",
  USA: "usa",
  ENG: "eng",
  CIV: "civ",
  KOR: "kor",
  IRN: "irn",
  TUR: "tur",
  CZE: "cze",
  CPV: "cpv",
  COD: "cod",
  NED: "ned",
  GER: "ger",
  BRA: "bra",
  ARG: "arg",
  FRA: "fra",
  MEX: "mex",
  CAN: "can",
  UZB: "uzb",
  RSA: "rsa",
  CUW: "cuw",
  NZL: "nzl",
  MAR: "mar",
  JPN: "jpn",
  SUI: "sui",
};

type PolymarketMarket = {
  question?: string;
  outcomes?: string;
  outcomePrices?: string;
};

type PolymarketEvent = {
  slug?: string;
  title?: string;
  markets?: PolymarketMarket[];
};

export interface PolymarketMatchProbabilities {
  home: number;
  draw: number;
  away: number;
}

function polyCode(fifaCode: string): string {
  return POLYMARKET_CODE_OVERRIDES[fifaCode] ?? fifaCode.toLowerCase();
}

function kickoffDateKeys(kickoffAt: string): string[] {
  const kickoff = parseISO(kickoffAt);
  const dates = new Set<string>();
  for (const tz of ["UTC", "America/New_York", "America/Los_Angeles"] as const) {
    dates.add(formatInTimeZone(kickoff, tz, "yyyy-MM-dd"));
  }
  return [...dates];
}

export function buildPolymarketMatchSlugs(
  home: Team,
  away: Team,
  kickoffAt: string
): string[] {
  const slugs = new Set<string>();
  for (const date of kickoffDateKeys(kickoffAt)) {
    slugs.add(`fifwc-${polyCode(home.fifa_code)}-${polyCode(away.fifa_code)}-${date}`);
    slugs.add(`fifwc-${polyCode(away.fifa_code)}-${polyCode(home.fifa_code)}-${date}`);
  }
  return [...slugs];
}

function parseYesProbability(market: PolymarketMarket): number | null {
  if (!market.outcomes || !market.outcomePrices) return null;
  try {
    const outcomes = JSON.parse(market.outcomes) as string[];
    const prices = JSON.parse(market.outcomePrices) as string[];
    const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === "yes");
    if (yesIndex < 0) return null;
    const probability = Number(prices[yesIndex]);
    return Number.isFinite(probability) && probability > 0 ? probability : null;
  } catch {
    return null;
  }
}

export function processPolymarketMatchMarkets(
  event: PolymarketEvent,
  homeTeam: Team,
  awayTeam: Team
): PolymarketMatchProbabilities | null {
  let homeRaw: number | null = null;
  let awayRaw: number | null = null;
  let drawRaw: number | null = null;

  for (const market of event.markets ?? []) {
    const question = market.question?.trim();
    if (!question) continue;
    const prob = parseYesProbability(market);
    if (prob == null) continue;

    if (/draw/i.test(question)) {
      drawRaw = prob;
      continue;
    }

    const winMatch = question.match(/^Will (.+?) win on /i);
    if (!winMatch) continue;
    const candidate = winMatch[1].trim();

    if (teamNameMatches(candidate, homeTeam)) homeRaw = prob;
    else if (teamNameMatches(candidate, awayTeam)) awayRaw = prob;
  }

  if (homeRaw == null || awayRaw == null) return null;

  const noVig = calculateNoVigProbabilities({
    home: homeRaw,
    draw: drawRaw ?? 0,
    away: awayRaw,
  });

  if (drawRaw != null) {
    return { home: noVig.home, draw: noVig.draw, away: noVig.away };
  }

  const twoWay = noVig.home + noVig.away;
  if (twoWay <= 0) return null;
  return {
    home: noVig.home / twoWay,
    draw: 0,
    away: noVig.away / twoWay,
  };
}

async function fetchPolymarketEventBySlug(slug: string): Promise<PolymarketEvent | null> {
  const res = await fetch(`${POLYMARKET_GAMMA}/events/slug/${slug}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return (await res.json()) as PolymarketEvent;
}

async function searchPolymarketMatchEvent(
  homeTeam: Team,
  awayTeam: Team
): Promise<PolymarketEvent | null> {
  const query = `${homeTeam.name} ${awayTeam.name} World Cup`;
  const res = await fetch(
    `${POLYMARKET_GAMMA}/public-search?q=${encodeURIComponent(query)}&limit_per_type=5`,
    { cache: "no-store", signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return null;

  const json = (await res.json()) as { events?: PolymarketEvent[] };
  for (const event of json.events ?? []) {
    if (!event.slug?.startsWith("fifwc-")) continue;
    const probs = processPolymarketMatchMarkets(event, homeTeam, awayTeam);
    if (probs) return event;
  }
  return null;
}

export async function fetchPolymarketMatchOdds(
  match: Pick<Match, "kickoff_at" | "home_team" | "away_team">
): Promise<{ event: PolymarketEvent; probabilities: PolymarketMatchProbabilities } | null> {
  const home = match.home_team;
  const away = match.away_team;
  if (!home || !away || !match.kickoff_at) return null;

  for (const slug of buildPolymarketMatchSlugs(home, away, match.kickoff_at)) {
    const event = await fetchPolymarketEventBySlug(slug);
    if (!event) continue;
    const probabilities = processPolymarketMatchMarkets(event, home, away);
    if (probabilities) return { event, probabilities };
  }

  const searched = await searchPolymarketMatchEvent(home, away);
  if (!searched) return null;
  const probabilities = processPolymarketMatchMarkets(searched, home, away);
  if (!probabilities) return null;
  return { event: searched, probabilities };
}

export function buildPolymarketOddsUpdate(
  match: Match,
  probabilities: PolymarketMatchProbabilities
): Record<string, unknown> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    odds_last_synced_at: now,
    odds_status: "synced",
    odds_source_note: "Polymarket · match moneyline",
    updated_at: now,
  };

  if (isKnockoutStage(match.stage)) {
    const twoWayTotal = probabilities.home + probabilities.away;
    const homeAdvance = probabilities.home / twoWayTotal;
    const awayAdvance = probabilities.away / twoWayTotal;
    Object.assign(update, {
      home_advance_probability: homeAdvance,
      away_advance_probability: awayAdvance,
      home_advance_bonus: probabilityToBonus(homeAdvance),
      away_advance_bonus: probabilityToBonus(awayAdvance),
    });
  } else {
    const bonuses = groupStageOutcomeBonusesFromImplied(
      probabilities.home,
      probabilities.draw,
      probabilities.away
    );
    Object.assign(update, {
      home_implied_probability: probabilities.home,
      draw_implied_probability: probabilities.draw,
      away_implied_probability: probabilities.away,
      home_win_bonus: bonuses.home,
      draw_bonus: bonuses.draw,
      away_win_bonus: bonuses.away,
    });
  }

  return update;
}

export function polymarketOddsMinSyncIntervalMs(): number {
  const n = Number(process.env.POLYMARKET_ODDS_MIN_INTERVAL_MS ?? "120000");
  return Number.isFinite(n) && n >= 30_000 ? n : 120_000;
}

export function polymarketOddsUrgentSyncIntervalMs(): number {
  const n = Number(process.env.POLYMARKET_ODDS_URGENT_INTERVAL_MS ?? "60000");
  return Number.isFinite(n) && n >= 15_000 ? n : 60_000;
}

async function getLastPolymarketOddsSyncTime(): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", POLYMARKET_ODDS_LAST_SYNC_KEY)
    .maybeSingle();
  const ts = Number(data?.value);
  return Number.isFinite(ts) ? ts : 0;
}

async function setLastPolymarketOddsSyncTime(ts: number): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("settings").upsert({
    key: POLYMARKET_ODDS_LAST_SYNC_KEY,
    value: ts,
    updated_at: new Date().toISOString(),
  });
}

export async function canSyncPolymarketOdds(
  force = false,
  urgent = false
): Promise<{ ok: boolean; reason?: string }> {
  if (force) return { ok: true };
  const minInterval = urgent
    ? polymarketOddsUrgentSyncIntervalMs()
    : polymarketOddsMinSyncIntervalMs();
  const last = await getLastPolymarketOddsSyncTime();
  if (last > 0 && Date.now() - last < minInterval) {
    return { ok: false, reason: "polymarket odds throttled" };
  }
  return { ok: true };
}

export async function markPolymarketOddsSynced(): Promise<void> {
  await setLastPolymarketOddsSyncTime(Date.now());
}
