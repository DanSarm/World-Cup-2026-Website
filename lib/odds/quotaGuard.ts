import { getSupabase } from "@/lib/supabaseServer";

const DAILY_SCORE_SYNCS_KEY = "odds_api_daily_score_syncs";
const DAILY_SCORE_SYNCS_DATE_KEY = "odds_api_daily_score_syncs_date";
const CREDITS_REMAINING_KEY = "odds_api_credits_remaining";
const COMPLETED_SYNC_DATE_KEY = "live_scores_completed_sync_date";
const ODDS_MATCH_SYNC_LAST_KEY = "odds_match_sync_last";
const ODDS_MATCH_SYNC_DAILY_KEY = "odds_match_sync_daily";
const ODDS_MATCH_SYNC_DATE_KEY = "odds_match_sync_date";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxDailyScoreSyncs(): number {
  const n = Number(process.env.LIVE_SCORES_MAX_SYNCS_PER_DAY ?? "12");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12;
}

function minCreditsReserve(): number {
  const n = Number(process.env.ODDS_API_MIN_CREDITS_RESERVE ?? "40");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 40;
}

async function readSetting(key: string): Promise<string | number | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

async function writeSetting(key: string, value: string | number): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
}

/** Reset daily counter when the UTC date rolls over. */
async function getDailyScoreSyncCount(): Promise<number> {
  const date = (await readSetting(DAILY_SCORE_SYNCS_DATE_KEY)) as string | null;
  const count = Number(await readSetting(DAILY_SCORE_SYNCS_KEY));
  if (date !== todayKey()) return 0;
  return Number.isFinite(count) ? count : 0;
}

export async function getStoredCreditsRemaining(): Promise<number | null> {
  const raw = await readSetting(CREDITS_REMAINING_KEY);
  if (raw == null || raw === "") return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

export async function recordOddsApiUsage(
  cost: number,
  creditsRemaining?: number | null
): Promise<void> {
  const today = todayKey();
  const date = (await readSetting(DAILY_SCORE_SYNCS_DATE_KEY)) as string | null;
  const prev =
    date === today ? Number(await readSetting(DAILY_SCORE_SYNCS_KEY)) : 0;
  const count = (Number.isFinite(prev) ? prev : 0) + 1;

  await writeSetting(DAILY_SCORE_SYNCS_DATE_KEY, today);
  await writeSetting(DAILY_SCORE_SYNCS_KEY, count);

  if (creditsRemaining != null && Number.isFinite(creditsRemaining)) {
    await writeSetting(CREDITS_REMAINING_KEY, creditsRemaining);
  }
}

export async function canSyncLiveScores(
  estimatedCost: number
): Promise<{ ok: boolean; reason?: string }> {
  if (process.env.LIVE_SCORES_ENABLED === "false") {
    return { ok: false, reason: "live scores disabled" };
  }

  const daily = await getDailyScoreSyncCount();
  if (daily >= maxDailyScoreSyncs()) {
    return { ok: false, reason: "daily sync limit reached" };
  }

  const remaining = await getStoredCreditsRemaining();
  if (
    remaining != null &&
    remaining < minCreditsReserve() + estimatedCost
  ) {
    return { ok: false, reason: "api credit reserve reached" };
  }

  return { ok: true };
}

/** At most one 2-credit completed-results sync per UTC day. */
export async function shouldIncludeRecentCompletedScores(): Promise<boolean> {
  const last = (await readSetting(COMPLETED_SYNC_DATE_KEY)) as string | null;
  return last !== todayKey();
}

export async function markCompletedScoresSyncDone(): Promise<void> {
  await writeSetting(COMPLETED_SYNC_DATE_KEY, todayKey());
}

export function minSyncIntervalMs(): number {
  const n = Number(process.env.LIVE_SCORES_MIN_INTERVAL_MS ?? "300000");
  return Number.isFinite(n) && n >= 60_000 ? n : 300_000;
}

export function liveScoresMaxSyncsPerDay(): number {
  return maxDailyScoreSyncs();
}

export function minOddsSyncIntervalMs(): number {
  const n = Number(process.env.ODDS_SYNC_MIN_INTERVAL_MS ?? "300000");
  return Number.isFinite(n) && n >= 60_000 ? n : 300_000;
}

export function minUrgentOddsSyncIntervalMs(): number {
  const n = Number(process.env.ODDS_SYNC_URGENT_INTERVAL_MS ?? "120000");
  return Number.isFinite(n) && n >= 30_000 ? n : 120_000;
}

function maxOddsMatchSyncsPerDay(): number {
  const n = Number(process.env.ODDS_SYNC_MAX_PER_DAY ?? "48");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 48;
}

async function getDailyOddsMatchSyncCount(): Promise<number> {
  const date = (await readSetting(ODDS_MATCH_SYNC_DATE_KEY)) as string | null;
  const count = Number(await readSetting(ODDS_MATCH_SYNC_DAILY_KEY));
  if (date !== todayKey()) return 0;
  return Number.isFinite(count) ? count : 0;
}

export async function getLastMatchOddsSyncTime(): Promise<number> {
  const raw = await readSetting(ODDS_MATCH_SYNC_LAST_KEY);
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : 0;
}

/** Throttle automatic match-odds syncs (one API call updates all fixtures). */
export async function canSyncMatchOdds(
  estimatedCost = 1,
  urgent = false
): Promise<{ ok: boolean; reason?: string }> {
  if (!process.env.ODDS_API_KEY?.trim()) {
    return { ok: false, reason: "odds api not configured" };
  }

  const minInterval = urgent ? minUrgentOddsSyncIntervalMs() : minOddsSyncIntervalMs();
  const last = await getLastMatchOddsSyncTime();
  if (last > 0 && Date.now() - last < minInterval) {
    return { ok: false, reason: "odds sync throttled" };
  }

  const daily = await getDailyOddsMatchSyncCount();
  if (daily >= maxOddsMatchSyncsPerDay()) {
    return { ok: false, reason: "daily odds sync limit reached" };
  }

  const remaining = await getStoredCreditsRemaining();
  if (remaining != null && remaining < minCreditsReserve() + estimatedCost) {
    return { ok: false, reason: "api credit reserve reached" };
  }

  return { ok: true };
}

export async function recordMatchOddsSync(
  cost: number,
  creditsRemaining?: number | null
): Promise<void> {
  await writeSetting(ODDS_MATCH_SYNC_LAST_KEY, Date.now());

  const today = todayKey();
  const date = (await readSetting(ODDS_MATCH_SYNC_DATE_KEY)) as string | null;
  const prev =
    date === today ? Number(await readSetting(ODDS_MATCH_SYNC_DAILY_KEY)) : 0;
  const count = (Number.isFinite(prev) ? prev : 0) + 1;

  await writeSetting(ODDS_MATCH_SYNC_DATE_KEY, today);
  await writeSetting(ODDS_MATCH_SYNC_DAILY_KEY, count);

  if (creditsRemaining != null && Number.isFinite(creditsRemaining)) {
    await writeSetting(CREDITS_REMAINING_KEY, creditsRemaining);
  }
}
