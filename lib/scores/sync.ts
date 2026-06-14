import { getSupabase } from "@/lib/supabaseServer";
import type { Match } from "@/lib/types";
import { isKnockoutStage } from "@/lib/types";
import { teamNameMatches } from "@/lib/odds/teamAliases";
import {
  canSyncLiveScores,
  markCompletedScoresSyncDone,
  minSyncIntervalMs,
  recordOddsApiUsage,
  shouldIncludeRecentCompletedScores,
} from "@/lib/odds/quotaGuard";
import { parseISO, format, addDays } from "date-fns";
import {
  shouldSyncLiveScoresFromApi,
  isMatchInPlayWindow,
  matchNeedsScoreSync,
  shouldAutoFinalizeMatch,
} from "@/lib/matchLive";
import {
  fetchLiveScores,
  isScoresApiConfigured,
  parseScoreEventScores,
  type OddsApiScoreEvent,
} from "./theOddsApiScores";
import {
  espnMinSyncIntervalMs,
  fetchEspnWorldCupEvents,
  matchEspnEventToFixture,
  scoreboardDatesForMatches,
} from "./espnScores";

const ODDS_LAST_SYNC_KEY = "live_scores_last_sync";
const ESPN_LAST_SYNC_KEY = "live_scores_last_espn_sync";

export interface SyncLiveScoresResult {
  synced: boolean;
  skipped?: string;
  updated: number;
  finalized: number;
  liveMatchIds: string[];
  finalizedMatchIds: string[];
  updatedMatchIds: string[];
  syncedAt: string;
  quotaCost?: number;
  source?: "espn" | "odds_api" | "none";
  liveClockByMatchId?: Record<string, string>;
}

function inferWinnerTeamId(
  match: Pick<Match, "home_team_id" | "away_team_id" | "stage">,
  homeScore: number,
  awayScore: number
): string | null {
  if (homeScore > awayScore) return match.home_team_id;
  if (awayScore > homeScore) return match.away_team_id;
  if (isKnockoutStage(match.stage)) return null;
  return null;
}

function matchOddsEventToFixture(
  events: OddsApiScoreEvent[],
  match: Match
): OddsApiScoreEvent | null {
  if (match.odds_event_id) {
    const linked = events.find((e) => e.id === match.odds_event_id);
    if (linked) return linked;
  }

  const home = match.home_team;
  const away = match.away_team;
  if (!home || !away) return null;

  const direct =
    events.find(
      (event) =>
        teamNameMatches(event.home_team, home) &&
        teamNameMatches(event.away_team, away)
    ) ?? null;
  if (direct) return direct;

  return (
    events.find(
      (event) =>
        teamNameMatches(event.home_team, away) &&
        teamNameMatches(event.away_team, home)
    ) ?? null
  );
}

async function getLastSyncTime(key: string): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (!data?.value) return 0;
  const ts = Number(data.value);
  return Number.isFinite(ts) ? ts : 0;
}

async function setLastSyncTime(key: string, ts: number): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("settings").upsert({
    key,
    value: ts,
    updated_at: new Date().toISOString(),
  });
}

function shouldSyncScores(matches: Match[]): boolean {
  if (shouldSyncLiveScoresFromApi(matches)) return true;
  const now = Date.now();
  const sixHoursMs = 6 * 60 * 60 * 1000;
  return matches.some((m) => {
    if (m.status === "final" || !m.kickoff_at) return false;
    const kickoff = parseISO(m.kickoff_at).getTime();
    return now >= kickoff && now - kickoff <= sixHoursMs;
  });
}

async function applyScoreUpdate(
  match: Match,
  homeScore: number,
  awayScore: number,
  completed: boolean,
  syncedAt: string
): Promise<"updated" | "finalized" | "skipped"> {
  const supabase = getSupabase();
  const winnerTeamId = inferWinnerTeamId(match, homeScore, awayScore);

  if (completed) {
    const { error } = await supabase
      .from("matches")
      .update({
        home_score: homeScore,
        away_score: awayScore,
        winner_team_id: winnerTeamId,
        status: "final",
        updated_at: syncedAt,
      })
      .eq("id", match.id);
    if (error) {
      console.error(
        `Final score update failed for match ${match.id}:`,
        error.message
      );
      return "skipped";
    }
    return "finalized";
  }

  const inPlay = isMatchInPlayWindow({
    ...match,
    home_score: homeScore,
    away_score: awayScore,
    status: "live",
  });
  if (!inPlay && match.status !== "live" && match.status !== "locked") {
    return "skipped";
  }

  // Use "locked" for in-progress updates — works on DBs that predate the
  // matches_status_check migration adding "live". UI treats locked+in-play as live.
  const { error } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      winner_team_id: winnerTeamId,
      status: "locked",
      updated_at: syncedAt,
    })
    .eq("id", match.id);

  if (error) {
    console.error(`Live score update failed for match ${match.id}:`, error.message);
    return "skipped";
  }
  return "updated";
}

async function syncFromEspn(
  matches: Match[],
  syncedAt: string
): Promise<{
  updated: number;
  finalized: number;
  liveMatchIds: string[];
  finalizedMatchIds: string[];
  updatedMatchIds: string[];
  needsRecalc: boolean;
  unresolved: Match[];
  liveClockByMatchId: Record<string, string>;
}> {
  const dates = scoreboardDatesForMatches(matches);
  const events = await fetchEspnWorldCupEvents(dates);

  let updated = 0;
  let finalized = 0;
  const liveMatchIds: string[] = [];
  const finalizedMatchIds: string[] = [];
  const updatedMatchIds: string[] = [];
  let needsRecalc = false;
  const unresolved: Match[] = [];
  const liveClockByMatchId: Record<string, string> = {};

  for (const match of matches) {
    if (!matchNeedsScoreSync(match)) continue;

    const event = matchEspnEventToFixture(events, match);
    if (!event) {
      unresolved.push(match);
      continue;
    }

    if (event.liveClockDisplay) {
      liveClockByMatchId[match.id] = event.liveClockDisplay;
    }

    const result = await applyScoreUpdate(
      match,
      event.homeScore,
      event.awayScore,
      event.completed,
      syncedAt
    );

    if (result === "finalized") {
      finalized++;
      finalizedMatchIds.push(match.id);
      needsRecalc = true;
    } else if (result === "updated") {
      updated++;
      updatedMatchIds.push(match.id);
      liveMatchIds.push(match.id);
    }
  }

  return {
    updated,
    finalized,
    liveMatchIds,
    finalizedMatchIds,
    updatedMatchIds,
    needsRecalc,
    unresolved,
    liveClockByMatchId,
  };
}

async function syncFromOddsApi(
  matches: Match[],
  syncedAt: string,
  onlyMatches: Match[]
): Promise<{
  updated: number;
  finalized: number;
  liveMatchIds: string[];
  finalizedMatchIds: string[];
  updatedMatchIds: string[];
  needsRecalc: boolean;
  quotaCost: number;
}> {
  const targetIds = new Set(onlyMatches.map((m) => m.id));
  const includeRecentCompleted =
    (await shouldIncludeRecentCompletedScores()) &&
    onlyMatches.some((m) => m.status === "live" || m.status === "scheduled");
  const estimatedCost = includeRecentCompleted ? 2 : 1;

  const quota = await canSyncLiveScores(estimatedCost);
  if (!quota.ok) {
    return {
      updated: 0,
      finalized: 0,
      liveMatchIds: [],
      finalizedMatchIds: [],
      updatedMatchIds: [],
      needsRecalc: false,
      quotaCost: 0,
    };
  }

  const lastSync = await getLastSyncTime(ODDS_LAST_SYNC_KEY);
  if (Date.now() - lastSync < minSyncIntervalMs()) {
    return {
      updated: 0,
      finalized: 0,
      liveMatchIds: [],
      finalizedMatchIds: [],
      updatedMatchIds: [],
      needsRecalc: false,
      quotaCost: 0,
    };
  }

  const { events, quotaCost, creditsRemaining } = await fetchLiveScores({
    includeRecentCompleted,
  });
  if (includeRecentCompleted) {
    await markCompletedScoresSyncDone();
  }
  await recordOddsApiUsage(quotaCost, creditsRemaining);

  let updated = 0;
  let finalized = 0;
  const liveMatchIds: string[] = [];
  const finalizedMatchIds: string[] = [];
  const updatedMatchIds: string[] = [];
  let needsRecalc = false;

  for (const match of matches) {
    if (!targetIds.has(match.id)) continue;

    const event = matchOddsEventToFixture(events, match);
    if (!event) continue;

    const parsed = parseScoreEventScores(event, match);
    if (!parsed) continue;

    const result = await applyScoreUpdate(
      match,
      parsed.homeScore,
      parsed.awayScore,
      event.completed,
      syncedAt
    );

    if (result === "finalized") {
      finalized++;
      finalizedMatchIds.push(match.id);
      needsRecalc = true;
    } else if (result === "updated") {
      updated++;
      updatedMatchIds.push(match.id);
      liveMatchIds.push(match.id);
    }
  }

  await setLastSyncTime(ODDS_LAST_SYNC_KEY, Date.now());

  return {
    updated,
    finalized,
    liveMatchIds,
    finalizedMatchIds,
    updatedMatchIds,
    needsRecalc,
    quotaCost,
  };
}

export async function syncLiveScores(
  force = false
): Promise<SyncLiveScoresResult> {
  const syncedAt = new Date().toISOString();

  const supabase = getSupabase();
  const { data: matchRows } = await supabase
    .from("matches")
    .select(
      "*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)"
    )
    .neq("status", "final")
    .not("home_team_id", "is", null)
    .not("away_team_id", "is", null);

  const matches = (matchRows ?? []) as Match[];

  if (!shouldSyncScores(matches)) {
    return {
      synced: false,
      skipped: "no match in play window",
      updated: 0,
      finalized: 0,
      liveMatchIds: [],
      finalizedMatchIds: [],
      updatedMatchIds: [],
      syncedAt,
      source: "none",
    };
  }

  const espnLastSync = await getLastSyncTime(ESPN_LAST_SYNC_KEY);
  const inPlayNeedsScore = matches.some(
    (m) =>
      matchNeedsScoreSync(m) &&
      (m.home_score === null ||
        m.away_score === null ||
        shouldAutoFinalizeMatch(m) ||
        (m.status === "locked" && !isMatchInPlayWindow(m)))
  );

  if (
    !force &&
    !inPlayNeedsScore &&
    Date.now() - espnLastSync < espnMinSyncIntervalMs()
  ) {
    return {
      synced: false,
      skipped: "throttled",
      updated: 0,
      finalized: 0,
      liveMatchIds: [],
      finalizedMatchIds: [],
      updatedMatchIds: [],
      syncedAt: new Date(espnLastSync).toISOString(),
      source: "none",
    };
  }

  let updated = 0;
  let finalized = 0;
  const liveMatchIds: string[] = [];
  const finalizedMatchIds: string[] = [];
  const updatedMatchIds: string[] = [];
  let needsRecalc = false;
  let quotaCost = 0;
  let source: SyncLiveScoresResult["source"] = "espn";
  let liveClockByMatchId: Record<string, string> = {};

  try {
    const espnResult = await syncFromEspn(matches, syncedAt);
    updated += espnResult.updated;
    finalized += espnResult.finalized;
    liveMatchIds.push(...espnResult.liveMatchIds);
    finalizedMatchIds.push(...espnResult.finalizedMatchIds);
    updatedMatchIds.push(...espnResult.updatedMatchIds);
    needsRecalc ||= espnResult.needsRecalc;
    liveClockByMatchId = espnResult.liveClockByMatchId;
    await setLastSyncTime(ESPN_LAST_SYNC_KEY, Date.now());

    const oddsFallback = espnResult.unresolved.filter((m) =>
      matchNeedsScoreSync(m)
    );

    if (oddsFallback.length > 0 && isScoresApiConfigured()) {
      const oddsResult = await syncFromOddsApi(matches, syncedAt, oddsFallback);
      if (oddsResult.updated + oddsResult.finalized > 0) {
        source = "odds_api";
      }
      updated += oddsResult.updated;
      finalized += oddsResult.finalized;
      liveMatchIds.push(...oddsResult.liveMatchIds);
      finalizedMatchIds.push(...oddsResult.finalizedMatchIds);
      updatedMatchIds.push(...oddsResult.updatedMatchIds);
      needsRecalc ||= oddsResult.needsRecalc;
      quotaCost += oddsResult.quotaCost;
    }
  } catch (error) {
    console.error("ESPN live score sync failed:", error);

    if (isScoresApiConfigured()) {
      const oddsResult = await syncFromOddsApi(
        matches,
        syncedAt,
        matches.filter(matchNeedsScoreSync)
      );
      updated = oddsResult.updated;
      finalized = oddsResult.finalized;
      liveMatchIds.push(...oddsResult.liveMatchIds);
      finalizedMatchIds.push(...oddsResult.finalizedMatchIds);
      updatedMatchIds.push(...oddsResult.updatedMatchIds);
      needsRecalc = oddsResult.needsRecalc;
      quotaCost = oddsResult.quotaCost;
      source = "odds_api";
    } else {
      return {
        synced: false,
        skipped: "espn failed and ODDS_API_KEY not set",
        updated: 0,
        finalized: 0,
        liveMatchIds: [],
        finalizedMatchIds: [],
        updatedMatchIds: [],
        syncedAt,
        source: "none",
      };
    }
  }

  const reconcile = await reconcileRecentFinalScores();
  if (reconcile.corrected > 0) {
    needsRecalc = true;
    finalizedMatchIds.push(...reconcile.correctedMatchIds);
  }

  if (needsRecalc || reconcile.needsRecalc) {
    const { recalculateAllScores } = await import("@/lib/data");
    await recalculateAllScores();
    const { fireScoreNotifications } = await import(
      "@/lib/notifications/scoreEvents"
    );
    fireScoreNotifications({
      finalizedMatchIds: [...new Set(finalizedMatchIds)],
      updatedMatchIds: [...new Set(updatedMatchIds)],
    });
  }

  return {
    synced: true,
    updated: updated + reconcile.corrected,
    finalized,
    liveMatchIds: [...new Set(liveMatchIds)],
    finalizedMatchIds: [...new Set(finalizedMatchIds)],
    updatedMatchIds: [...new Set(updatedMatchIds)],
    syncedAt,
    quotaCost,
    source,
    liveClockByMatchId,
  };
}

const RECONCILE_FINAL_HOURS = 72;

export interface ReconcileFinalScoresResult {
  corrected: number;
  correctedMatchIds: string[];
  needsRecalc: boolean;
}

/** Fix recently finalized matches when external APIs report a different FT score. */
export async function reconcileRecentFinalScores(): Promise<ReconcileFinalScoresResult> {
  const supabase = getSupabase();
  const now = Date.now();
  const cutoff = now - RECONCILE_FINAL_HOURS * 60 * 60 * 1000;
  const syncedAt = new Date().toISOString();

  const { data: matchRows } = await supabase
    .from("matches")
    .select(
      "*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)"
    )
    .eq("status", "final")
    .not("home_team_id", "is", null)
    .not("away_team_id", "is", null)
    .not("kickoff_at", "is", null);

  const matches = ((matchRows ?? []) as Match[]).filter((match) => {
    if (!match.kickoff_at) return false;
    const kickoff = parseISO(match.kickoff_at).getTime();
    return kickoff >= cutoff && kickoff <= now;
  });

  if (!matches.length) {
    return { corrected: 0, correctedMatchIds: [], needsRecalc: false };
  }

  const dates = new Set<string>();
  for (const match of matches) {
    const kickoff = parseISO(match.kickoff_at!);
    dates.add(format(kickoff, "yyyyMMdd"));
    dates.add(format(addDays(kickoff, -1), "yyyyMMdd"));
    dates.add(format(addDays(kickoff, 1), "yyyyMMdd"));
  }

  const events = await fetchEspnWorldCupEvents([...dates]);
  let corrected = 0;
  let needsRecalc = false;
  const correctedMatchIds: string[] = [];

  for (const match of matches) {
    const event = matchEspnEventToFixture(events, match);
    if (!event?.completed) continue;
    if (
      event.homeScore === match.home_score &&
      event.awayScore === match.away_score
    ) {
      continue;
    }

    const winnerTeamId = inferWinnerTeamId(
      match,
      event.homeScore,
      event.awayScore
    );
    const { error } = await supabase
      .from("matches")
      .update({
        home_score: event.homeScore,
        away_score: event.awayScore,
        winner_team_id: winnerTeamId,
        status: "final",
        updated_at: syncedAt,
      })
      .eq("id", match.id);

    if (error) {
      console.error(
        `Final score reconcile failed for match ${match.match_number}:`,
        error.message
      );
      continue;
    }

    console.warn(
      `Reconciled match ${match.match_number}: ${match.home_score}-${match.away_score} -> ${event.homeScore}-${event.awayScore}`
    );
    corrected++;
    correctedMatchIds.push(match.id);
    needsRecalc = true;
  }

  return { corrected, correctedMatchIds, needsRecalc };
}
