import { getSupabase } from "@/lib/supabaseServer";
import { logAudit } from "@/lib/auth";
import type { Match, OddsStatus, Team } from "@/lib/types";
import { isKnockoutStage } from "@/lib/types";
import { getOddsConfig } from "./config";
import { validateOddsSchema } from "./schemaCheck";
import { canSyncMatchOdds, minOddsSyncIntervalMs } from "./quotaGuard";
import { isMatchMissingDisplayOdds } from "@/lib/matchOdds";
import {
  buildEspnOddsUpdate,
  canSyncEspnOdds,
  fetchEspnWorldCupOddsFixtures,
  markEspnOddsSynced,
  matchEspnOddsToFixture,
  scoreboardDatesForOddsMatches,
} from "./espnMatchOdds";
import {
  buildPolymarketOddsUpdate,
  canSyncPolymarketOdds,
  fetchPolymarketMatchOdds,
  markPolymarketOddsSynced,
} from "./polymarketMatchOdds";
import {
  fetchUpcomingOdds,
  matchOddsEventToFixture,
  processAdvanceOdds,
  processH2hOdds,
  processKnockoutOddsFromH2h,
  type OddsApiEvent,
} from "./theOddsApi";

export interface SyncOddsResult {
  matchId: string;
  status: "synced" | "skipped" | "failed" | "locked" | "needs_manual";
  message?: string;
  suggestions?: OddsApiEvent[];
  bookmakerCount?: number;
}

export interface SyncUpcomingResult {
  synced: number;
  skipped: number;
  failed: number;
  locked: number;
  needsManual: number;
  results: SyncOddsResult[];
}

function getLockTime(kickoffAt: string, lockHours: number): number {
  return new Date(kickoffAt).getTime() - lockHours * 3600000;
}

export function isOddsLockedForMatch(
  match: Pick<Match, "kickoff_at" | "odds_status" | "odds_locked_at">
): boolean {
  if (match.odds_status === "locked") return true;
  if (match.odds_locked_at) return true;

  const config = getOddsConfig();
  if (!match.kickoff_at) return false;
  return Date.now() >= getLockTime(match.kickoff_at, config.lockHoursBeforeKickoff);
}

async function loadMatchWithTeams(matchId: string): Promise<Match | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("matches")
    .select(
      "*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)"
    )
    .eq("id", matchId)
    .maybeSingle();
  return (data as Match | null) ?? null;
}

async function loadMatchesByIds(matchIds: string[]): Promise<Match[]> {
  if (!matchIds.length) return [];
  const supabase = getSupabase();
  const { data } = await supabase
    .from("matches")
    .select(
      "*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)"
    )
    .in("id", matchIds)
    .order("match_number");
  return (data ?? []) as Match[];
}

function usePaidMatchOdds(): boolean {
  return process.env.ODDS_USE_PAID_MATCH_ODDS === "true";
}

async function replaceSnapshots(
  matchId: string,
  snapshots: ReturnType<typeof processH2hOdds>["snapshots"]
): Promise<void> {
  const supabase = getSupabase();
  const { error: delErr } = await supabase
    .from("odds_snapshots")
    .delete()
    .eq("match_id", matchId);
  if (delErr) throw new Error(`Failed to clear odds snapshots: ${delErr.message}`);

  if (snapshots.length) {
    const { error: insErr } = await supabase.from("odds_snapshots").insert(snapshots);
    if (insErr) throw new Error(`Failed to save odds snapshots: ${insErr.message}`);
  }
}

async function updateMatch(
  matchId: string,
  update: Record<string, unknown>
): Promise<void> {
  const { error } = await getSupabase().from("matches").update(update).eq("id", matchId);
  if (error) throw new Error(`Failed to update match odds: ${error.message}`);
}

async function markOddsLocked(matchId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("matches")
    .update({
      odds_status: "locked",
      odds_locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
}

/** Sync odds for a single match from The Odds API. */
export async function syncOddsForMatch(
  matchId: string,
  options: {
    force?: boolean;
    eventId?: string;
    actorId?: string | null;
    events?: OddsApiEvent[];
  } = {}
): Promise<SyncOddsResult> {
  const config = getOddsConfig();
  const match = await loadMatchWithTeams(matchId);

  if (!match) {
    return { matchId, status: "failed", message: "Match not found" };
  }

  if (!config.apiKey) {
    return { matchId, status: "failed", message: "ODDS_API_KEY is not configured" };
  }

  if (match.odds_status === "manual" && !options.force) {
    return { matchId, status: "skipped", message: "Manual odds — sync skipped" };
  }

  if (isOddsLockedForMatch(match) && !options.force) {
    if (match.odds_status !== "locked") {
      await markOddsLocked(matchId);
    }
    return { matchId, status: "locked", message: "Odds locked before kickoff" };
  }

  if (!match.home_team_id || !match.away_team_id || !match.home_team || !match.away_team) {
    return { matchId, status: "skipped", message: "Teams not set" };
  }

  try {
    const events = options.events ?? (await fetchUpcomingOdds());
    const linkedId = options.eventId ?? match.odds_event_id;
    const matched = matchOddsEventToFixture(events, match, linkedId);

    if (!matched.event) {
      await updateMatch(matchId, {
        odds_status: "failed",
        odds_source_note: matched.warning ?? "Could not match odds event",
        updated_at: new Date().toISOString(),
      });

      if (options.actorId) {
        await logAudit(options.actorId, "odds_sync_failed", {
          matchId,
          warning: matched.warning,
        });
      }

      return {
        matchId,
        status: "needs_manual",
        message: matched.warning,
        suggestions: matched.suggestions,
      };
    }

    const event = matched.event;
    const homeTeam = match.home_team as Team;
    const awayTeam = match.away_team as Team;
    const provider = config.provider;
    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
      odds_event_id: event.id,
      odds_last_synced_at: now,
      odds_status: "synced",
      odds_source_note: `The Odds API · ${provider}`,
      updated_at: now,
    };

    let bookmakerCount = 0;
    let snapshots: ReturnType<typeof processH2hOdds>["snapshots"] = [];

    if (!isKnockoutStage(match.stage)) {
      const h2h = processH2hOdds(event, matchId, homeTeam, awayTeam, provider);
      if (!h2h.bookmakerCount) {
        throw new Error("No valid h2h bookmakers found");
      }
      bookmakerCount = h2h.bookmakerCount;
      snapshots = h2h.snapshots;
      Object.assign(update, {
        home_implied_probability: h2h.homeImplied,
        draw_implied_probability: h2h.drawImplied,
        away_implied_probability: h2h.awayImplied,
        home_win_bonus: h2h.homeBonus,
        draw_bonus: h2h.drawBonus,
        away_win_bonus: h2h.awayBonus,
      });
    } else {
      const advance =
        processAdvanceOdds(event, matchId, homeTeam, awayTeam, provider) ??
        processKnockoutOddsFromH2h(event, matchId, homeTeam, awayTeam, provider);
      if (advance) {
        bookmakerCount = advance.bookmakerCount;
        snapshots = advance.snapshots;
        Object.assign(update, {
          home_advance_probability: advance.homeAdvanceImplied,
          away_advance_probability: advance.awayAdvanceImplied,
          home_advance_bonus: advance.homeAdvanceBonus,
          away_advance_bonus: advance.awayAdvanceBonus,
        });
      } else {
        update.odds_source_note = `${provider} · knockout odds unavailable — set bonuses manually`;
      }
    }

    await replaceSnapshots(matchId, snapshots);
    await updateMatch(matchId, update);

    if (options.actorId) {
      await logAudit(options.actorId, "odds_synced", {
        matchId,
        eventId: event.id,
        bookmakerCount,
        confidence: matched.confidence,
      });
    }

    return {
      matchId,
      status: "synced",
      bookmakerCount,
      message: `Synced from ${bookmakerCount} bookmaker(s)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Odds sync failed";

    if (options.actorId) {
      await logAudit(options.actorId, "odds_sync_error", { matchId, message });
    }

    try {
      await updateMatch(matchId, {
        odds_status: match.odds_last_synced_at ? match.odds_status : "failed",
        odds_source_note: message,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // schema may be missing — message already explains
    }

    return { matchId, status: "failed", message };
  }
}

export interface SyncUpcomingOptions {
  actorId?: string | null;
  skipSchemaCheck?: boolean;
  /** Bypass throttle — admin manual sync. */
  force?: boolean;
  /** Shorter min interval when fixtures are missing percentages. */
  urgent?: boolean;
}

/** Whether a fixture should be included in the next automatic odds refresh. */
export function matchNeedsOddsSync(match: Match): boolean {
  if (match.status !== "scheduled") return false;
  if (!match.home_team_id || !match.away_team_id) return false;
  if (match.odds_status === "manual") return false;
  if (isOddsLockedForMatch(match)) return false;
  if (isMatchMissingDisplayOdds(match)) return true;
  if (!match.odds_last_synced_at) return true;

  const staleMs = minOddsSyncIntervalMs();
  return Date.now() - new Date(match.odds_last_synced_at).getTime() > staleMs;
}

export interface MaybeSyncOddsResult {
  synced: boolean;
  reason?: string;
  result?: SyncUpcomingResult;
}

/** Background odds refresh for visible picks — free sources first, no live-score impact. */
export async function maybeSyncUpcomingOdds(
  matches: Match[]
): Promise<MaybeSyncOddsResult> {
  const needsSync = matches.filter(matchNeedsOddsSync);
  if (!needsSync.length) {
    return { synced: false, reason: "none needed" };
  }

  const urgent = needsSync.some(isMatchMissingDisplayOdds);
  let combined: SyncUpcomingResult | undefined;
  let synced = false;

  const polymarketResult = await syncOddsFromPolymarketForMatches(needsSync, { urgent });
  if (polymarketResult.synced > 0) {
    synced = true;
    combined = polymarketResult;
  }

  let refreshed = await loadMatchesByIds(needsSync.map((m) => m.id));
  let stillNeeding = refreshed.filter(matchNeedsOddsSync);

  const espnResult = await syncOddsFromEspnForMatches(stillNeeding, { urgent });
  if (espnResult.synced > 0) {
    synced = true;
    combined = combined
      ? {
          ...combined,
          synced: combined.synced + espnResult.synced,
          results: [...combined.results, ...espnResult.results],
        }
      : espnResult;
  }

  if (usePaidMatchOdds()) {
    refreshed = await loadMatchesByIds(needsSync.map((m) => m.id));
    stillNeeding = refreshed.filter(matchNeedsOddsSync);
    if (stillNeeding.length) {
      const oddsApiGuard = await canSyncMatchOdds(1, urgent);
      if (oddsApiGuard.ok) {
        const paidResult = await syncOddsForUpcomingMatches({
          skipSchemaCheck: true,
          urgent,
        });
        if (paidResult.synced > 0) {
          synced = true;
          combined = combined
            ? {
                ...combined,
                synced: combined.synced + paidResult.synced,
                results: [...combined.results, ...paidResult.results],
              }
            : paidResult;
        }
      }
    }
  }

  return {
    synced,
    reason: combined?.schemaError,
    result: combined,
  };
}

/** Free Polymarket match moneyline — primary source for match win percentages. */
export async function syncOddsFromPolymarketForMatches(
  matches: Match[],
  options: { force?: boolean; urgent?: boolean } = {}
): Promise<SyncUpcomingResult> {
  const result: SyncUpcomingResult = {
    synced: 0,
    skipped: 0,
    failed: 0,
    locked: 0,
    needsManual: 0,
    results: [],
  };

  const eligible = matches.filter((match) => {
    if (!matchNeedsOddsSync(match)) return false;
    return isMatchMissingDisplayOdds(match) || options.force;
  });
  if (!eligible.length) return result;

  const guard = await canSyncPolymarketOdds(options.force, options.urgent);
  if (!guard.ok) {
    return { ...result, schemaError: guard.reason };
  }

  for (const match of eligible) {
    if (match.odds_status === "manual") {
      result.skipped++;
      result.results.push({ matchId: match.id, status: "skipped", message: "Manual odds" });
      continue;
    }

    if (isOddsLockedForMatch(match)) {
      result.locked++;
      result.results.push({ matchId: match.id, status: "locked" });
      continue;
    }

    if (!match.home_team || !match.away_team || !match.kickoff_at) {
      result.skipped++;
      result.results.push({ matchId: match.id, status: "skipped", message: "Teams not set" });
      continue;
    }

    try {
      const fetched = await fetchPolymarketMatchOdds(match);
      if (!fetched) {
        result.needsManual++;
        result.results.push({
          matchId: match.id,
          status: "needs_manual",
          message: "No Polymarket match market",
        });
        continue;
      }

      const update = buildPolymarketOddsUpdate(match, fetched.probabilities);
      await updateMatch(match.id, update);
      result.synced++;
      result.results.push({
        matchId: match.id,
        status: "synced",
        message: `Synced from Polymarket (${fetched.event.slug ?? "search"})`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Polymarket odds sync failed";
      result.failed++;
      result.results.push({ matchId: match.id, status: "failed", message });
    }
  }

  if (result.synced > 0) {
    await markPolymarketOddsSynced();
  }

  return result;
}

/** Free ESPN/DraftKings moneyline fallback when The Odds API is unavailable. */
export async function syncOddsFromEspnForMatches(
  matches: Match[],
  options: { force?: boolean; urgent?: boolean } = {}
): Promise<SyncUpcomingResult> {
  const result: SyncUpcomingResult = {
    synced: 0,
    skipped: 0,
    failed: 0,
    locked: 0,
    needsManual: 0,
    results: [],
  };

  const eligible = matches.filter((match) => {
    if (!matchNeedsOddsSync(match)) return false;
    return isMatchMissingDisplayOdds(match) || options.force;
  });
  if (!eligible.length) {
    return result;
  }

  const guard = await canSyncEspnOdds(options.force, options.urgent);
  if (!guard.ok) {
    return { ...result, schemaError: guard.reason };
  }

  const dates = scoreboardDatesForOddsMatches(eligible);
  if (!dates.length) {
    return result;
  }

  let fixtures;
  try {
    fixtures = await fetchEspnWorldCupOddsFixtures(dates);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ESPN odds fetch failed";
    return { ...result, schemaError: message };
  }

  if (!fixtures.length) {
    return result;
  }

  for (const match of eligible) {
    if (match.odds_status === "manual") {
      result.skipped++;
      result.results.push({ matchId: match.id, status: "skipped", message: "Manual odds" });
      continue;
    }

    if (isOddsLockedForMatch(match)) {
      result.locked++;
      result.results.push({ matchId: match.id, status: "locked" });
      continue;
    }

    const fixture = matchEspnOddsToFixture(fixtures, match);
    if (!fixture?.moneyline) {
      result.needsManual++;
      result.results.push({
        matchId: match.id,
        status: "needs_manual",
        message: "No ESPN moneyline for fixture",
      });
      continue;
    }

    const update = buildEspnOddsUpdate(match, fixture);
    if (!update) {
      result.failed++;
      result.results.push({
        matchId: match.id,
        status: "failed",
        message: "Could not parse ESPN moneyline",
      });
      continue;
    }

    try {
      await updateMatch(match.id, update);
      result.synced++;
      result.results.push({
        matchId: match.id,
        status: "synced",
        message: "Synced from ESPN moneyline",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "ESPN odds update failed";
      result.failed++;
      result.results.push({ matchId: match.id, status: "failed", message });
    }
  }

  if (result.synced > 0) {
    await markEspnOddsSynced();
  }

  return result;
}

/** Sync odds for all eligible upcoming matches. */
export async function syncOddsForUpcomingMatches(
  actorIdOrOptions?: string | null | SyncUpcomingOptions
): Promise<SyncUpcomingResult & { schemaError?: string }> {
  const options: SyncUpcomingOptions =
    typeof actorIdOrOptions === "object" && actorIdOrOptions !== null
      ? actorIdOrOptions
      : { actorId: actorIdOrOptions ?? null };

  if (!options.skipSchemaCheck) {
    const schema = await validateOddsSchema();
    if (!schema.ok) {
      return {
        synced: 0,
        skipped: 0,
        failed: 0,
        locked: 0,
        needsManual: 0,
        results: [],
        schemaError: schema.error,
      };
    }
  }

  if (!options.force) {
    const guard = await canSyncMatchOdds(1, options.urgent);
    if (!guard.ok) {
      return {
        synced: 0,
        skipped: 0,
        failed: 0,
        locked: 0,
        needsManual: 0,
        results: [],
        schemaError: guard.reason,
      };
    }
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select(
      "*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)"
    )
    .eq("status", "scheduled")
    .not("home_team_id", "is", null)
    .not("away_team_id", "is", null)
    .not("kickoff_at", "is", null)
    .gt("kickoff_at", now)
    .order("kickoff_at");

  if (matchErr) {
    return {
      synced: 0,
      skipped: 0,
      failed: 0,
      locked: 0,
      needsManual: 0,
      results: [],
      schemaError: matchErr.message,
    };
  }

  let events: OddsApiEvent[] = [];
  try {
    events = await fetchUpcomingOdds();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch odds";
    return {
      synced: 0,
      skipped: 0,
      failed: 0,
      locked: 0,
      needsManual: 0,
      results: [],
      schemaError: message,
    };
  }

  if (!events.length) {
    return {
      synced: 0,
      skipped: 0,
      failed: 0,
      locked: 0,
      needsManual: 0,
      results: [],
      schemaError: "odds api unavailable",
    };
  }

  const result: SyncUpcomingResult = {
    synced: 0,
    skipped: 0,
    failed: 0,
    locked: 0,
    needsManual: 0,
    results: [],
  };

  for (const row of (matches ?? []) as Match[]) {
    if (row.odds_status === "manual") {
      result.skipped++;
      result.results.push({ matchId: row.id, status: "skipped", message: "Manual odds" });
      continue;
    }

    if (isOddsLockedForMatch(row)) {
      if (row.odds_status !== "locked") {
        await markOddsLocked(row.id);
      }
      result.locked++;
      result.results.push({ matchId: row.id, status: "locked" });
      continue;
    }

    const syncResult = await syncOddsForMatch(row.id, {
      actorId: options.actorId,
      events,
    });
    result.results.push(syncResult);

    switch (syncResult.status) {
      case "synced":
        result.synced++;
        break;
      case "skipped":
        result.skipped++;
        break;
      case "locked":
        result.locked++;
        break;
      case "needs_manual":
        result.needsManual++;
        break;
      default:
        result.failed++;
    }
  }

  return result;
}

export async function getOddsSnapshotsForMatch(matchId: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("odds_snapshots")
    .select("*")
    .eq("match_id", matchId)
    .order("bookmaker_title")
    .order("outcome_type");
  return data ?? [];
}

export async function lockOddsForMatch(matchId: string, actorId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("matches")
    .update({
      odds_status: "locked",
      odds_locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  await logAudit(actorId, "odds_locked", { matchId });
}

export async function unlockOddsForMatch(
  matchId: string,
  actorId: string
): Promise<{ ok: boolean; error?: string }> {
  const match = await loadMatchWithTeams(matchId);
  if (!match?.kickoff_at) {
    return { ok: false, error: "Kickoff time required" };
  }
  if (new Date(match.kickoff_at).getTime() <= Date.now()) {
    return { ok: false, error: "Cannot unlock after kickoff" };
  }

  const supabase = getSupabase();
  await supabase
    .from("matches")
    .update({
      odds_status: match.odds_last_synced_at ? "synced" : "not_synced",
      odds_locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  await logAudit(actorId, "odds_unlocked", { matchId });
  return { ok: true };
}

export async function markMatchManualOdds(matchId: string, actorId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("matches")
    .update({
      odds_status: "manual" as OddsStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  await logAudit(actorId, "odds_manual", { matchId });
}

export async function linkOddsEventToMatch(
  matchId: string,
  eventId: string,
  actorId: string
): Promise<SyncOddsResult> {
  await getSupabase()
    .from("matches")
    .update({ odds_event_id: eventId, updated_at: new Date().toISOString() })
    .eq("id", matchId);
  await logAudit(actorId, "odds_event_linked", { matchId, eventId });
  return syncOddsForMatch(matchId, { eventId, actorId });
}
