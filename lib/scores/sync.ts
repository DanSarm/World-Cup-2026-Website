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
import { shouldSyncLiveScoresFromApi } from "@/lib/matchLive";
import {
  fetchLiveScores,
  isScoreEventLive,
  isScoresApiConfigured,
  parseScoreEventScores,
  type OddsApiScoreEvent,
} from "./theOddsApiScores";

const SETTINGS_KEY = "live_scores_last_sync";

export interface SyncLiveScoresResult {
  synced: boolean;
  skipped?: string;
  updated: number;
  finalized: number;
  liveMatchIds: string[];
  syncedAt: string;
  quotaCost?: number;
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

function matchScoreEventToFixture(
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

  return (
    events.find(
      (event) =>
        event.scores?.length &&
        teamNameMatches(event.home_team, home) &&
        teamNameMatches(event.away_team, away)
    ) ?? null
  );
}

async function getLastSyncTime(): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (!data?.value) return 0;
  const ts = Number(data.value);
  return Number.isFinite(ts) ? ts : 0;
}

async function setLastSyncTime(ts: number): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("settings").upsert({
    key: SETTINGS_KEY,
    value: ts,
    updated_at: new Date().toISOString(),
  });
}

export async function syncLiveScores(
  force = false
): Promise<SyncLiveScoresResult> {
  const syncedAt = new Date().toISOString();

  if (!isScoresApiConfigured()) {
    return {
      synced: false,
      skipped: "ODDS_API_KEY not set",
      updated: 0,
      finalized: 0,
      liveMatchIds: [],
      syncedAt,
    };
  }

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

  if (!shouldSyncLiveScoresFromApi(matches)) {
    return {
      synced: false,
      skipped: "no match in play window",
      updated: 0,
      finalized: 0,
      liveMatchIds: [],
      syncedAt,
    };
  }

  const includeRecentCompleted =
    (await shouldIncludeRecentCompletedScores()) &&
    matches.some((m) => m.status === "live" || m.status === "scheduled");
  const estimatedCost = includeRecentCompleted ? 2 : 1;

  const quota = await canSyncLiveScores(estimatedCost);
  if (!quota.ok) {
    return {
      synced: false,
      skipped: quota.reason,
      updated: 0,
      finalized: 0,
      liveMatchIds: [],
      syncedAt,
    };
  }

  const lastSync = await getLastSyncTime();
  if (!force && Date.now() - lastSync < minSyncIntervalMs()) {
    return {
      synced: false,
      skipped: "throttled",
      updated: 0,
      finalized: 0,
      liveMatchIds: [],
      syncedAt: new Date(lastSync).toISOString(),
    };
  }

  if (!matches.length) {
    await setLastSyncTime(Date.now());
    return {
      synced: true,
      updated: 0,
      finalized: 0,
      liveMatchIds: [],
      syncedAt,
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
  let needsRecalc = false;

  for (const match of matches) {
    const event = matchScoreEventToFixture(events, match);
    if (!event) continue;

    const parsed = parseScoreEventScores(event);
    if (!parsed) continue;

    const { homeScore, awayScore } = parsed;
    const winnerTeamId = inferWinnerTeamId(match, homeScore, awayScore);
    const lastUpdate = event.last_update ?? syncedAt;

    if (event.completed) {
      await supabase
        .from("matches")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          winner_team_id: winnerTeamId,
          status: "final",
          live_updated_at: lastUpdate,
          updated_at: syncedAt,
        })
        .eq("id", match.id);
      finalized++;
      needsRecalc = true;
      continue;
    }

    if (!isScoreEventLive(event)) continue;

    await supabase
      .from("matches")
      .update({
        home_score: homeScore,
        away_score: awayScore,
        winner_team_id: winnerTeamId,
        status: "live",
        live_updated_at: lastUpdate,
        updated_at: syncedAt,
      })
      .eq("id", match.id);

    updated++;
    liveMatchIds.push(match.id);
  }

  if (needsRecalc) {
    const { recalculateAllScores } = await import("@/lib/data");
    await recalculateAllScores();
  }

  await setLastSyncTime(Date.now());

  return {
    synced: true,
    updated,
    finalized,
    liveMatchIds,
    syncedAt,
    quotaCost,
  };
}
