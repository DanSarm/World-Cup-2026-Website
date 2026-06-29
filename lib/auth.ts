import { cache } from "react";
import bcrypt from "bcryptjs";
import { getSupabase } from "./supabaseServer";
import { getTeamIdByCode } from "./teamsDb";
import {
  normalizeDisplayName,
  normalizedDisplayNameKey,
} from "./playerNames";
import {
  createSession,
  setSessionCookie,
  getSession,
  clearSessionCookie,
} from "./session";
import type { SessionPlayer, Settings } from "./types";

function supabaseErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "PGRST205") {
    return "Database tables missing. Open Supabase → SQL Editor → run supabase/schema.sql";
  }
  return "Could not reach database. Check Supabase keys and run schema.sql.";
}

function getDatabaseConfigError(): string | null {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;
  if (!key || key === "your_service_role_key") {
    return "Database not configured. Add your Supabase secret key to .env.local.";
  }
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url?.startsWith("http")) {
    return "Database URL not configured. Check SUPABASE_URL in .env.local.";
  }
  return null;
}

const DEFAULT_SETTINGS: Settings = {
  buy_in: 40,
  pool_locked: false,
  big_predictions_locked: false,
  finals_challenge_open: false,
  tournament_complete: false,
  payout_percentages: {
    overall_first: 55,
    overall_second: 25,
    overall_third: 15,
    exact_score: 0,
    finals_challenge: 0,
    fun_prize: 0,
  },
  exact_score_fire_bonus_enabled: true,
  group_stage_match_point_cap: 18,
  perfect_day_bonus_enabled: true,
  perfect_day_bonus_points: 5,
  odds_lock_hours_before_kickoff: 1,
};

async function loadSettings(): Promise<Settings> {
  const supabase = getSupabase();
  const { data } = await supabase.from("settings").select("key, value");

  const settings = { ...DEFAULT_SETTINGS };
  if (!data) return settings;

  for (const row of data) {
    switch (row.key) {
      case "buy_in":
        settings.buy_in = Number(row.value);
        break;
      case "pool_locked":
        settings.pool_locked = Boolean(row.value);
        break;
      case "big_predictions_locked":
        settings.big_predictions_locked = Boolean(row.value);
        break;
      case "finals_challenge_open":
        settings.finals_challenge_open = Boolean(row.value);
        break;
      case "tournament_complete":
        settings.tournament_complete = Boolean(row.value);
        break;
      case "payout_percentages":
        settings.payout_percentages = row.value as Settings["payout_percentages"];
        break;
      case "fun_prize_winner_id":
        settings.fun_prize_winner_id = row.value as string | null;
        break;
      case "crazy_scoreline_bonus_enabled":
        settings.crazy_scoreline_bonus_enabled = Boolean(row.value);
        settings.exact_score_fire_bonus_enabled = Boolean(row.value);
        break;
      case "exact_score_fire_bonus_enabled":
        settings.exact_score_fire_bonus_enabled = Boolean(row.value);
        break;
      case "max_group_match_points":
        settings.max_group_match_points = Number(row.value);
        settings.group_stage_match_point_cap = Number(row.value);
        break;
      case "group_stage_match_point_cap":
        settings.group_stage_match_point_cap = Number(row.value);
        break;
      case "perfect_day_bonus_enabled":
        settings.perfect_day_bonus_enabled = Boolean(row.value);
        break;
      case "perfect_day_bonus_points":
        settings.perfect_day_bonus_points = Number(row.value);
        break;
      case "odds_lock_hours_before_kickoff":
        settings.odds_lock_hours_before_kickoff = Number(row.value);
        break;
      case "champion_probabilities":
        settings.champion_probabilities = row.value as Record<string, number>;
        break;
    }
  }

  return settings;
}

export const getSettings = cache(loadSettings);

async function findPlayerByDisplayName<
  T extends { display_name: string },
>(select: string, displayName: string): Promise<T | null> {
  const supabase = getSupabase();
  const key = normalizedDisplayNameKey(displayName);
  const { data, error } = await supabase.from("players").select(select);

  if (error) {
    console.error("player lookup error:", error);
    return null;
  }

  const rows = (data ?? []) as unknown as T[];
  const matches = rows.filter(
    (row) => normalizedDisplayNameKey(row.display_name) === key
  );

  if (matches.length > 1) {
    console.error("duplicate display names for key:", key, matches);
  }

  return (matches[0] as T | undefined) ?? null;
}

export async function registerPlayer(input: {
  displayName: string;
  pin: string;
  favoriteTeamCode?: string | null;
  adminInviteCode?: string;
}): Promise<{ success: boolean; error?: string }> {
  const configError = getDatabaseConfigError();
  if (configError) return { success: false, error: configError };

  const displayName = normalizeDisplayName(input.displayName);
  const supabase = getSupabase();

  const existing = await findPlayerByDisplayName<{ id: string; display_name: string }>(
    "id, display_name",
    displayName
  );

  if (existing) {
    return { success: false, error: "Name already taken — use Enter to sign in" };
  }

  const pinHash = await bcrypt.hash(input.pin, 10);
  const isAdmin =
    !!input.adminInviteCode &&
    input.adminInviteCode === process.env.ADMIN_INVITE_CODE;

  let favoriteTeamId: string | null = null;
  if (input.favoriteTeamCode) {
    favoriteTeamId = await getTeamIdByCode(input.favoriteTeamCode);
  }

  const { data: player, error } = await supabase
    .from("players")
    .insert({
      display_name: displayName,
      pin_hash: pinHash,
      favorite_team_id: favoriteTeamId,
      is_admin: isAdmin,
    })
    .select("id, display_name, avatar_emoji, is_admin, paid")
    .single();

  if (error || !player) {
    console.error("register insert error:", error);
    if (error?.code === "23505") {
      return {
        success: false,
        error: "Name already taken — use Enter to sign in",
      };
    }
    return {
      success: false,
      error:
        "Could not create account. Run supabase/schema.sql in Supabase first.",
    };
  }

  const sessionPlayer: SessionPlayer = {
    id: player.id,
    display_name: player.display_name,
    avatar_emoji: player.avatar_emoji ?? "⚽",
    is_admin: player.is_admin,
    paid: player.paid,
  };

  const token = await createSession(sessionPlayer);
  await setSessionCookie(token);

  await supabase
    .from("players")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", player.id);

  return { success: true };
}

export async function loginPlayer(input: {
  displayName: string;
  pin: string;
  adminInviteCode?: string;
}): Promise<{ success: boolean; error?: string }> {
  const configError = getDatabaseConfigError();
  if (configError) return { success: false, error: configError };

  const displayName = normalizeDisplayName(input.displayName);
  const player = await findPlayerByDisplayName<{
    id: string;
    display_name: string;
    pin_hash: string;
    avatar_emoji: string | null;
    is_admin: boolean;
    paid: boolean;
  }>(
    "id, display_name, pin_hash, avatar_emoji, is_admin, paid",
    displayName
  );

  if (!player) {
    return {
      success: false,
      error: "No account found. First time? Tap Join above.",
    };
  }

  const valid = await bcrypt.compare(input.pin, player.pin_hash);
  if (!valid) {
    return { success: false, error: "Wrong PIN for this name" };
  }

  const supabase = getSupabase();
  let isAdmin = player.is_admin;
  if (
    input.adminInviteCode &&
    input.adminInviteCode === process.env.ADMIN_INVITE_CODE
  ) {
    isAdmin = true;
    await supabase
      .from("players")
      .update({ is_admin: true })
      .eq("id", player.id);
  }

  const sessionPlayer: SessionPlayer = {
    id: player.id,
    display_name: player.display_name,
    avatar_emoji: player.avatar_emoji ?? "⚽",
    is_admin: isAdmin,
    paid: player.paid,
  };

  const token = await createSession(sessionPlayer);
  await setSessionCookie(token);

  await supabase
    .from("players")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", player.id);

  return { success: true };
}

export async function logoutPlayer(): Promise<void> {
  await clearSessionCookie();
}

export async function refreshSessionFromDb(): Promise<SessionPlayer | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = getSupabase();
  const { data: player } = await supabase
    .from("players")
    .select("id, display_name, avatar_emoji, is_admin, paid")
    .eq("id", session.id)
    .maybeSingle();

  if (!player) {
    await clearSessionCookie();
    return null;
  }

  return {
    id: player.id,
    display_name: player.display_name,
    avatar_emoji: player.avatar_emoji ?? "⚽",
    is_admin: player.is_admin,
    paid: player.paid,
  };
}

export async function logAudit(
  actorId: string | null,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("audit_log").insert({
    actor_player_id: actorId,
    action,
    details,
  });
}
