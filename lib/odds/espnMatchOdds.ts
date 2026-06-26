import { addDays, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Match, Team } from "@/lib/types";
import { isKnockoutStage } from "@/lib/types";
import { teamNameMatches } from "./teamAliases";
import {
  calculateNoVigProbabilities,
  decimalToImplied,
  groupStageOutcomeBonusesFromImplied,
  probabilityToBonus,
} from "./math";
import { espnScoreboardDatesForKickoff } from "@/lib/scores/espnScores";
import { getSupabase } from "@/lib/supabaseServer";
import type { ProcessedAdvanceOdds, ProcessedH2hOdds } from "./theOddsApi";

const ESPN_WC_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const ESPN_ODDS_LAST_SYNC_KEY = "espn_odds_last_sync";

export interface EspnMoneylineOdds {
  homeAmerican: number;
  awayAmerican: number;
  drawAmerican: number | null;
}

export interface EspnOddsFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string | null;
  moneyline: EspnMoneylineOdds | null;
}

interface EspnCompetitor {
  homeAway?: "home" | "away";
  team?: { displayName?: string; abbreviation?: string };
}

interface EspnMoneylineSide {
  close?: { odds?: string | number };
}

interface EspnOddsBlock {
  moneyline?: {
    home?: EspnMoneylineSide;
    away?: EspnMoneylineSide;
    draw?: EspnMoneylineSide;
  };
}

interface EspnScoreboardResponse {
  events?: Array<{
    id: string;
    date?: string;
    competitions?: Array<{
      id: string;
      competitors?: EspnCompetitor[];
      odds?: EspnOddsBlock[];
    }>;
  }>;
}

function parseAmericanOdds(value: string | number | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

export function americanToDecimal(american: number): number {
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

function parseEspnOddsFixture(
  raw: NonNullable<EspnScoreboardResponse["events"]>[number]
): EspnOddsFixture | null {
  const competition = raw.competitions?.[0];
  if (!competition) return null;

  const home = competition.competitors?.find((c) => c.homeAway === "home");
  const away = competition.competitors?.find((c) => c.homeAway === "away");
  if (!home?.team?.displayName || !away?.team?.displayName) return null;

  const ml = competition.odds?.[0]?.moneyline;
  const homeAmerican = parseAmericanOdds(ml?.home?.close?.odds);
  const awayAmerican = parseAmericanOdds(ml?.away?.close?.odds);
  if (homeAmerican == null || awayAmerican == null) return null;

  return {
    id: raw.id,
    homeTeam: home.team.displayName,
    awayTeam: away.team.displayName,
    kickoffAt: raw.date ?? null,
    moneyline: {
      homeAmerican,
      awayAmerican,
      drawAmerican: parseAmericanOdds(ml?.draw?.close?.odds),
    },
  };
}

export function espnOddsMinSyncIntervalMs(): number {
  const n = Number(process.env.ESPN_ODDS_MIN_INTERVAL_MS ?? "120000");
  return Number.isFinite(n) && n >= 30_000 ? n : 120_000;
}

export function espnOddsUrgentSyncIntervalMs(): number {
  const n = Number(process.env.ESPN_ODDS_URGENT_INTERVAL_MS ?? "30000");
  return Number.isFinite(n) && n >= 15_000 ? n : 30_000;
}

async function getLastEspnOddsSyncTime(): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", ESPN_ODDS_LAST_SYNC_KEY)
    .maybeSingle();
  const ts = Number(data?.value);
  return Number.isFinite(ts) ? ts : 0;
}

async function setLastEspnOddsSyncTime(ts: number): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("settings").upsert({
    key: ESPN_ODDS_LAST_SYNC_KEY,
    value: ts,
    updated_at: new Date().toISOString(),
  });
}

export async function canSyncEspnOdds(
  force = false,
  urgent = false
): Promise<{ ok: boolean; reason?: string }> {
  if (force) return { ok: true };
  const minInterval = urgent ? espnOddsUrgentSyncIntervalMs() : espnOddsMinSyncIntervalMs();
  const last = await getLastEspnOddsSyncTime();
  if (last > 0 && Date.now() - last < minInterval) {
    return { ok: false, reason: "espn odds throttled" };
  }
  return { ok: true };
}

export function scoreboardDatesForOddsMatches(matches: Match[]): string[] {
  const dates = new Set<string>();
  const now = Date.now();
  const horizonMs = 21 * 24 * 60 * 60 * 1000;

  for (const match of matches) {
    if (!match.kickoff_at) continue;
    if (match.status === "final") continue;
    const kickoff = parseISO(match.kickoff_at).getTime();
    if (kickoff < now - 12 * 60 * 60 * 1000) continue;
    if (kickoff > now + horizonMs) continue;
    for (const d of espnScoreboardDatesForKickoff(match.kickoff_at)) {
      dates.add(d);
    }
  }

  return [...dates].sort();
}

export async function fetchEspnWorldCupOddsFixtures(
  dates: string[]
): Promise<EspnOddsFixture[]> {
  if (!dates.length) return [];

  const uniqueDates = [...new Set(dates)];
  const responses = await Promise.all(
    uniqueDates.map(async (date) => {
      const url = `${ESPN_WC_SCOREBOARD}?dates=${date}`;
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return [] as EspnOddsFixture[];
      const json = (await res.json()) as EspnScoreboardResponse;
      return (json.events ?? [])
        .map(parseEspnOddsFixture)
        .filter((e): e is EspnOddsFixture => e != null);
    })
  );

  const byId = new Map<string, EspnOddsFixture>();
  for (const batch of responses) {
    for (const fixture of batch) {
      byId.set(fixture.id, fixture);
    }
  }
  return [...byId.values()];
}

export function matchEspnOddsToFixture(
  fixtures: EspnOddsFixture[],
  match: Match
): EspnOddsFixture | null {
  const home = match.home_team;
  const away = match.away_team;
  if (!home || !away) return null;

  const direct =
    fixtures.find(
      (fixture) =>
        teamNameMatches(fixture.homeTeam, home) &&
        teamNameMatches(fixture.awayTeam, away)
    ) ?? null;
  if (direct) return direct;

  return (
    fixtures.find(
      (fixture) =>
        teamNameMatches(fixture.homeTeam, away) &&
        teamNameMatches(fixture.awayTeam, home)
    ) ?? null
  );
}

export function processEspnMoneylineForGroup(
  moneyline: EspnMoneylineOdds,
  homeTeam: Team,
  awayTeam: Team
): Pick<
  ProcessedH2hOdds,
  "homeImplied" | "drawImplied" | "awayImplied" | "homeBonus" | "drawBonus" | "awayBonus"
> | null {
  const homeDecimal = americanToDecimal(moneyline.homeAmerican);
  const awayDecimal = americanToDecimal(moneyline.awayAmerican);
  const drawDecimal =
    moneyline.drawAmerican != null ? americanToDecimal(moneyline.drawAmerican) : null;

  const homeRaw = decimalToImplied(homeDecimal);
  const awayRaw = decimalToImplied(awayDecimal);
  const drawRaw = drawDecimal != null ? decimalToImplied(drawDecimal) : null;
  if (!homeRaw || !awayRaw) return null;

  const noVig =
    drawRaw != null
      ? calculateNoVigProbabilities({ home: homeRaw, draw: drawRaw, away: awayRaw })
      : calculateNoVigProbabilities({ home: homeRaw, away: awayRaw });

  const bonuses = groupStageOutcomeBonusesFromImplied(
    noVig.home,
    noVig.draw,
    noVig.away
  );

  return {
    homeImplied: noVig.home,
    drawImplied: noVig.draw,
    awayImplied: noVig.away,
    homeBonus: bonuses.home,
    drawBonus: bonuses.draw,
    awayBonus: bonuses.away,
  };
}

export function processEspnMoneylineForKnockout(
  moneyline: EspnMoneylineOdds
): Pick<
  ProcessedAdvanceOdds,
  | "homeAdvanceImplied"
  | "awayAdvanceImplied"
  | "homeAdvanceBonus"
  | "awayAdvanceBonus"
> | null {
  const homeDecimal = americanToDecimal(moneyline.homeAmerican);
  const awayDecimal = americanToDecimal(moneyline.awayAmerican);
  const drawDecimal =
    moneyline.drawAmerican != null ? americanToDecimal(moneyline.drawAmerican) : null;

  const homeRaw = decimalToImplied(homeDecimal);
  const awayRaw = decimalToImplied(awayDecimal);
  const drawRaw = drawDecimal != null ? decimalToImplied(drawDecimal) : null;
  if (!homeRaw || !awayRaw) return null;

  let homeNorm: number;
  let awayNorm: number;

  if (drawRaw != null) {
    const noVig = calculateNoVigProbabilities({
      home: homeRaw,
      draw: drawRaw,
      away: awayRaw,
    });
    const twoWayTotal = noVig.home + noVig.away;
    if (twoWayTotal <= 0) return null;
    homeNorm = noVig.home / twoWayTotal;
    awayNorm = noVig.away / twoWayTotal;
  } else {
    const noVig = calculateNoVigProbabilities({ home: homeRaw, away: awayRaw });
    homeNorm = noVig.home;
    awayNorm = noVig.away;
  }

  return {
    homeAdvanceImplied: homeNorm,
    awayAdvanceImplied: awayNorm,
    homeAdvanceBonus: probabilityToBonus(homeNorm),
    awayAdvanceBonus: probabilityToBonus(awayNorm),
  };
}

export function buildEspnOddsUpdate(
  match: Match,
  fixture: EspnOddsFixture
): Record<string, unknown> | null {
  if (!fixture.moneyline || !match.home_team || !match.away_team) return null;

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    odds_last_synced_at: now,
    odds_status: "synced",
    odds_source_note: "ESPN · DraftKings moneyline",
    updated_at: now,
  };

  if (isKnockoutStage(match.stage)) {
    const knockout = processEspnMoneylineForKnockout(fixture.moneyline);
    if (!knockout) return null;
    Object.assign(update, {
      home_advance_probability: knockout.homeAdvanceImplied,
      away_advance_probability: knockout.awayAdvanceImplied,
      home_advance_bonus: knockout.homeAdvanceBonus,
      away_advance_bonus: knockout.awayAdvanceBonus,
    });
  } else {
    const group = processEspnMoneylineForGroup(
      fixture.moneyline,
      match.home_team,
      match.away_team
    );
    if (!group) return null;
    Object.assign(update, {
      home_implied_probability: group.homeImplied,
      draw_implied_probability: group.drawImplied,
      away_implied_probability: group.awayImplied,
      home_win_bonus: group.homeBonus,
      draw_bonus: group.drawBonus,
      away_win_bonus: group.awayBonus,
    });
  }

  return update;
}

export async function markEspnOddsSynced(): Promise<void> {
  await setLastEspnOddsSyncTime(Date.now());
}
