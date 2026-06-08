"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "./supabaseServer";
import {
  registerPlayer,
  loginPlayer,
  logoutPlayer,
  logAudit,
  getSettings,
} from "./auth";
import { requireSession, requireAdmin } from "./session";
import {
  registerSchema,
  loginSchema,
  matchPickSchema,
  bigPickSchema,
  finalsChallengeSchema,
  payoutSchema,
  matchResultSchema,
} from "./validation";
import { isMatchLocked } from "./utils";
import { recalculateAllScores } from "./data";
import type { Match } from "./types";

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    familyCode: formData.get("familyCode"),
    displayName: formData.get("displayName"),
    pin: formData.get("pin"),
    favoriteTeamCode: formData.get("favoriteTeamCode") || null,
    adminInviteCode: formData.get("adminInviteCode") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const result = await registerPlayer(parsed.data);
  if (!result.success) return { error: result.error };
  revalidatePath("/");
  return { success: true };
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    displayName: formData.get("displayName"),
    pin: formData.get("pin"),
    adminInviteCode: formData.get("adminInviteCode") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const result = await loginPlayer(parsed.data);
  if (!result.success) return { error: result.error };
  revalidatePath("/");
  return { success: true };
}

export async function logoutAction() {
  await logoutPlayer();
  revalidatePath("/");
}

export async function saveMatchPickAction(formData: FormData) {
  const session = await requireSession();
  const supabase = getSupabase();

  const matchId = formData.get("matchId") as string;
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Match not found" };

  const m = match as Match;
  if (isMatchLocked(m)) return { error: "Pick locked" };

  const parsed = matchPickSchema.safeParse({
    matchId,
    predHomeScore: Number(formData.get("predHomeScore")),
    predAwayScore: Number(formData.get("predAwayScore")),
    predWinnerTeamId: formData.get("predWinnerTeamId") || null,
    isKnockout: m.stage !== "group",
    homeTeamId: m.home_team_id,
    awayTeamId: m.away_team_id,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid pick" };
  }

  const { error } = await supabase.from("match_predictions").upsert(
    {
      player_id: session.id,
      match_id: matchId,
      pred_home_score: parsed.data.predHomeScore,
      pred_away_score: parsed.data.predAwayScore,
      pred_winner_team_id: parsed.data.predWinnerTeamId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,match_id" }
  );

  if (error) return { error: "Could not save pick" };

  await logAudit(session.id, "save_match_pick", { matchId });
  revalidatePath("/picks");
  revalidatePath("/");
  return { success: true };
}

export async function saveBigPicksAction(formData: FormData) {
  const session = await requireSession();
  const settings = await getSettings();
  if (settings.big_predictions_locked) {
    return { error: "Big Picks are locked" };
  }

  const groupWinners: Record<string, string> = {};
  const groupRunnersUp: Record<string, string> = {};

  for (const letter of "ABCDEFGHIJKL") {
    const w = formData.get(`groupWinner_${letter}`);
    const r = formData.get(`groupRunnerUp_${letter}`);
    if (w) groupWinners[letter] = w as string;
    if (r) groupRunnersUp[letter] = r as string;
  }

  const semifinalists = [
    formData.get("semifinalist_0"),
    formData.get("semifinalist_1"),
    formData.get("semifinalist_2"),
    formData.get("semifinalist_3"),
  ].filter(Boolean) as string[];

  const finalists = [
    formData.get("finalist_0"),
    formData.get("finalist_1"),
  ].filter(Boolean) as string[];

  const parsed = bigPickSchema.safeParse({
    groupWinners,
    groupRunnersUp,
    semifinalists,
    finalists,
    championTeamId: formData.get("championTeamId"),
    topScorer: formData.get("topScorer") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid picks" };
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("big_predictions").upsert(
    {
      player_id: session.id,
      group_winners: parsed.data.groupWinners,
      group_runners_up: parsed.data.groupRunnersUp,
      semifinalists: parsed.data.semifinalists,
      finalists: parsed.data.finalists,
      champion_team_id: parsed.data.championTeamId,
      top_scorer: parsed.data.topScorer ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id" }
  );

  if (error) return { error: "Could not save" };

  await logAudit(session.id, "save_big_picks", {});
  revalidatePath("/big-picks");
  return { success: true };
}

export async function saveFinalsChallengeAction(formData: FormData) {
  const session = await requireSession();
  const settings = await getSettings();
  if (!settings.finals_challenge_open) {
    return { error: "Finals Challenge not open yet" };
  }

  const quarterfinalists = Array.from({ length: 8 }, (_, i) =>
    formData.get(`qf_${i}`)
  ).filter(Boolean) as string[];

  const semifinalists = Array.from({ length: 4 }, (_, i) =>
    formData.get(`sf_${i}`)
  ).filter(Boolean) as string[];

  const finalists = [
    formData.get("finalist_0"),
    formData.get("finalist_1"),
  ].filter(Boolean) as string[];

  const parsed = finalsChallengeSchema.safeParse({
    quarterfinalists,
    semifinalists,
    finalists,
    championTeamId: formData.get("championTeamId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid picks" };
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("finals_challenge_predictions").upsert(
    {
      player_id: session.id,
      quarterfinalists: parsed.data.quarterfinalists,
      semifinalists: parsed.data.semifinalists,
      finalists: parsed.data.finalists,
      champion_team_id: parsed.data.championTeamId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id" }
  );

  if (error) return { error: "Could not save" };

  await logAudit(session.id, "save_finals_challenge", {});
  revalidatePath("/big-picks");
  revalidatePath("/leaderboard");
  return { success: true };
}

export async function adminTogglePaidAction(playerId: string, paid: boolean) {
  const admin = await requireAdmin();
  const supabase = getSupabase();
  const settings = await getSettings();

  await supabase
    .from("players")
    .update({ paid, paid_amount: paid ? settings.buy_in : 0 })
    .eq("id", playerId);

  await logAudit(admin.id, "toggle_paid", { playerId, paid });
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/");
}

export async function adminToggleAdminAction(playerId: string, isAdmin: boolean) {
  const admin = await requireAdmin();
  const supabase = getSupabase();
  await supabase.from("players").update({ is_admin: isAdmin }).eq("id", playerId);
  await logAudit(admin.id, "toggle_admin", { playerId, isAdmin });
  revalidatePath("/admin");
}

export async function adminUpdateSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = getSupabase();

  const buyIn = Number(formData.get("buy_in"));
  const payoutParsed = payoutSchema.safeParse({
    overall_first: Number(formData.get("overall_first")),
    overall_second: Number(formData.get("overall_second")),
    overall_third: Number(formData.get("overall_third")),
    exact_score: Number(formData.get("exact_score")),
    finals_challenge: Number(formData.get("finals_challenge")),
    fun_prize: Number(formData.get("fun_prize")),
  });

  if (!payoutParsed.success) {
    return { error: payoutParsed.error.errors[0]?.message };
  }

  await supabase.from("settings").upsert([
    { key: "buy_in", value: buyIn },
    { key: "payout_percentages", value: payoutParsed.data },
    {
      key: "big_predictions_locked",
      value: formData.get("big_predictions_locked") === "on",
    },
    {
      key: "finals_challenge_open",
      value: formData.get("finals_challenge_open") === "on",
    },
    {
      key: "tournament_complete",
      value: formData.get("tournament_complete") === "on",
    },
    {
      key: "fun_prize_winner_id",
      value: formData.get("fun_prize_winner_id") || null,
    },
    {
      key: "exact_score_fire_bonus_enabled",
      value: formData.get("exact_score_fire_bonus_enabled") === "on",
    },
    {
      key: "group_stage_match_point_cap",
      value: Math.max(
        6,
        Math.min(30, Number(formData.get("group_stage_match_point_cap")) || 18)
      ),
    },
    {
      key: "perfect_day_bonus_enabled",
      value: formData.get("perfect_day_bonus_enabled") === "on",
    },
    {
      key: "perfect_day_bonus_points",
      value: Math.max(
        0,
        Math.min(20, Number(formData.get("perfect_day_bonus_points")) || 5)
      ),
    },
    {
      key: "odds_lock_hours_before_kickoff",
      value: Math.max(
        0,
        Math.min(24, Number(formData.get("odds_lock_hours_before_kickoff")) || 1)
      ),
    },
  ]);

  await logAudit(admin.id, "update_settings", {});
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/");
  revalidatePath("/picks");
  return { success: true };
}

export async function adminSaveMatchResultAction(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = getSupabase();

  const matchId = formData.get("matchId") as string;
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Match not found" };

  const parsed = matchResultSchema.safeParse({
    matchId,
    homeScore: Number(formData.get("homeScore")),
    awayScore: Number(formData.get("awayScore")),
    winnerTeamId: formData.get("winnerTeamId") || null,
    decidedByPenalties: formData.get("decidedByPenalties") === "on",
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    isKnockout: match.stage !== "group",
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message };
  }

  let winnerTeamId = parsed.data.winnerTeamId;
  if (!winnerTeamId && match.stage !== "group") {
    if (parsed.data.homeScore > parsed.data.awayScore) {
      winnerTeamId = match.home_team_id;
    } else if (parsed.data.awayScore > parsed.data.homeScore) {
      winnerTeamId = match.away_team_id;
    }
  } else if (!winnerTeamId && match.stage === "group") {
    winnerTeamId = null;
  } else if (!winnerTeamId) {
    winnerTeamId =
      parsed.data.homeScore > parsed.data.awayScore
        ? match.home_team_id
        : parsed.data.awayScore > parsed.data.homeScore
          ? match.away_team_id
          : null;
  }

  await supabase
    .from("matches")
    .update({
      home_score: parsed.data.homeScore,
      away_score: parsed.data.awayScore,
      winner_team_id: winnerTeamId,
      decided_by_penalties: parsed.data.decidedByPenalties,
      status: "final",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  await recalculateAllScores();
  await logAudit(admin.id, "save_match_result", { matchId });
  revalidatePath("/admin");
  revalidatePath("/picks");
  revalidatePath("/leaderboard");
  revalidatePath("/");
  return { success: true };
}

export async function adminRecalculateAction() {
  const admin = await requireAdmin();
  await recalculateAllScores();
  await logAudit(admin.id, "recalculate_scores", {});
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/");
  return { success: true };
}

export async function adminAdjustPointsAction(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = getSupabase();

  const playerId = formData.get("playerId") as string;
  const points = Number(formData.get("points"));
  const reason = formData.get("reason") as string;

  if (!reason?.trim()) return { error: "Reason required" };

  await supabase.from("manual_adjustments").insert({
    player_id: playerId,
    points,
    reason,
    created_by: admin.id,
  });

  await recalculateAllScores();
  await logAudit(admin.id, "manual_adjustment", { playerId, points, reason });
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  return { success: true };
}

export async function adminImportCsvAction(csvText: string) {
  const admin = await requireAdmin();
  const supabase = getSupabase();
  const teams = await supabase.from("teams").select("id, fifa_code");
  const teamMap = new Map(
    (teams.data ?? []).map((t) => [t.fifa_code, t.id])
  );

  const lines = csvText.trim().split("\n");
  const header = lines[0]?.split(",").map((h) => h.trim());
  if (!header) return { error: "Empty CSV" };

  let imported = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });

    const homeTeamId = row.home_team_code
      ? teamMap.get(row.home_team_code) ?? null
      : null;
    const awayTeamId = row.away_team_code
      ? teamMap.get(row.away_team_code) ?? null
      : null;

    const kickoffAt = row.kickoff_at
      ? new Date(row.kickoff_at).toISOString()
      : null;

    await supabase.from("matches").upsert(
      {
        match_number: Number(row.match_number),
        stage: row.stage,
        group_letter: row.group_letter || null,
        kickoff_at: kickoffAt,
        venue: row.venue || null,
        city: row.city || null,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_label: row.home_label,
        away_label: row.away_label,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_number" }
    );
    imported++;
  }

  await logAudit(admin.id, "import_csv", { imported });
  revalidatePath("/admin");
  revalidatePath("/picks");
  return { success: true as const, imported };
}

export async function adminUpdateMatchAction(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = getSupabase();

  const matchId = formData.get("matchId") as string;
  const kickoffRaw = formData.get("kickoff_at") as string;

  await supabase
    .from("matches")
    .update({
      kickoff_at: kickoffRaw ? new Date(kickoffRaw).toISOString() : null,
      venue: (formData.get("venue") as string) || null,
      home_label: formData.get("home_label") as string,
      away_label: formData.get("away_label") as string,
      home_team_id: (formData.get("home_team_id") as string) || null,
      away_team_id: (formData.get("away_team_id") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  await logAudit(admin.id, "update_match", { matchId });
  revalidatePath("/admin");
  revalidatePath("/picks");
  return { success: true };
}

export async function adminUpdateMatchBonusesAction(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = getSupabase();

  const matchId = formData.get("matchId") as string;
  const forceLocked = formData.get("forceLocked") === "1";

  const { data: existing } = await supabase
    .from("matches")
    .select("odds_status, odds_locked_at")
    .eq("id", matchId)
    .maybeSingle();

  const isLocked =
    existing?.odds_status === "locked" || Boolean(existing?.odds_locked_at);
  if (isLocked && !forceLocked) {
    return { error: "Odds are locked. Confirm override to save." };
  }

  const num = (key: string) => {
    const v = Number(formData.get(key));
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  };

  const update: Record<string, unknown> = {
    home_win_bonus: num("home_win_bonus"),
    draw_bonus: num("draw_bonus"),
    away_win_bonus: num("away_win_bonus"),
    home_advance_bonus: num("home_advance_bonus"),
    away_advance_bonus: num("away_advance_bonus"),
    odds_source_note: (formData.get("odds_source_note") as string) || null,
    updated_at: new Date().toISOString(),
  };

  if (forceLocked) {
    update.odds_status = "manual";
  }

  await supabase.from("matches").update(update).eq("id", matchId);

  await logAudit(admin.id, "update_match_bonuses", { matchId, forceLocked });
  revalidatePath("/admin");
  revalidatePath("/picks");
  return { success: true };
}

export async function adminLockOddsAction(formData: FormData) {
  const admin = await requireAdmin();
  const matchId = formData.get("matchId") as string;
  const { lockOddsForMatch } = await import("@/lib/odds/sync");
  await lockOddsForMatch(matchId, admin.id);
  revalidatePath("/admin");
  revalidatePath("/picks");
  return { success: true };
}

export async function adminUnlockOddsAction(formData: FormData) {
  const admin = await requireAdmin();
  const matchId = formData.get("matchId") as string;
  const { unlockOddsForMatch } = await import("@/lib/odds/sync");
  const result = await unlockOddsForMatch(matchId, admin.id);
  revalidatePath("/admin");
  revalidatePath("/picks");
  return result;
}

export async function adminMarkManualOddsAction(formData: FormData) {
  const admin = await requireAdmin();
  const matchId = formData.get("matchId") as string;
  const { markMatchManualOdds } = await import("@/lib/odds/sync");
  await markMatchManualOdds(matchId, admin.id);
  revalidatePath("/admin");
  revalidatePath("/picks");
  return { success: true };
}

export async function adminOverridePickAction(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = getSupabase();

  const playerId = formData.get("playerId") as string;
  const matchId = formData.get("matchId") as string;

  await supabase.from("match_predictions").upsert(
    {
      player_id: playerId,
      match_id: matchId,
      pred_home_score: Number(formData.get("predHomeScore")),
      pred_away_score: Number(formData.get("predAwayScore")),
      pred_winner_team_id: (formData.get("predWinnerTeamId") as string) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,match_id" }
  );

  await recalculateAllScores();
  await logAudit(admin.id, "override_pick", { playerId, matchId });
  revalidatePath("/admin");
  return { success: true };
}

export async function adminSetActualResultsAction(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = getSupabase();

  const entries: Array<{ key: string; value: unknown }> = [];

  for (const letter of "ABCDEFGHIJKL") {
    const gw = formData.get(`group_winner_${letter}`);
    const gr = formData.get(`group_runner_${letter}`);
    if (gw) entries.push({ key: "group_winners_partial", value: { [letter]: gw } });
    if (gr) entries.push({ key: "group_runners_partial", value: { [letter]: gr } });
  }

  const champion = formData.get("champion");
  const topScorer = formData.get("top_scorer");

  if (champion) {
    await supabase.from("actual_tournament_results").upsert({
      key: "champion",
      value: champion,
    });
  }
  if (topScorer) {
    await supabase.from("actual_tournament_results").upsert({
      key: "top_scorer",
      value: topScorer,
    });
  }

  const groupWinners: Record<string, string> = {};
  const groupRunnersUp: Record<string, string> = {};
  for (const letter of "ABCDEFGHIJKL") {
    const gw = formData.get(`group_winner_${letter}`);
    const gr = formData.get(`group_runner_${letter}`);
    if (gw) groupWinners[letter] = gw as string;
    if (gr) groupRunnersUp[letter] = gr as string;
  }

  if (Object.keys(groupWinners).length) {
    await supabase.from("actual_tournament_results").upsert({
      key: "group_winners",
      value: groupWinners,
    });
  }
  if (Object.keys(groupRunnersUp).length) {
    await supabase.from("actual_tournament_results").upsert({
      key: "group_runners_up",
      value: groupRunnersUp,
    });
  }

  const sf = Array.from({ length: 4 }, (_, i) => formData.get(`sf_${i}`)).filter(Boolean);
  const fi = Array.from({ length: 2 }, (_, i) => formData.get(`fi_${i}`)).filter(Boolean);
  const qf = Array.from({ length: 8 }, (_, i) => formData.get(`qf_${i}`)).filter(Boolean);

  if (sf.length) {
    await supabase.from("actual_tournament_results").upsert({ key: "semifinalists", value: sf });
  }
  if (fi.length) {
    await supabase.from("actual_tournament_results").upsert({ key: "finalists", value: fi });
  }
  if (qf.length) {
    await supabase.from("actual_tournament_results").upsert({ key: "quarterfinalists", value: qf });
  }

  await recalculateAllScores();
  await logAudit(admin.id, "set_actual_results", {});
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  return { success: true };
}

export async function adminExportCsvAction(type: string): Promise<string> {
  await requireAdmin();
  const supabase = getSupabase();

  if (type === "players") {
    const { data } = await supabase.from("players").select("display_name, paid, is_admin, created_at");
    const header = "display_name,paid,is_admin,created_at";
    const rows = (data ?? []).map(
      (p) => `${p.display_name},${p.paid},${p.is_admin},${p.created_at}`
    );
    return [header, ...rows].join("\n");
  }

  if (type === "leaderboard") {
    const { getLeaderboardData } = await import("./data");
    const { leaderboard } = await getLeaderboardData();
    const header = "rank,name,points,exact_scores,projected_prize";
    const rows = leaderboard.map(
      (e) =>
        `${e.rank},${e.displayName},${e.totalPoints},${e.exactScores},${e.projectedPrize}`
    );
    return [header, ...rows].join("\n");
  }

  const { data } = await supabase
    .from("match_predictions")
    .select("player_id, match_id, pred_home_score, pred_away_score");
  const header = "player_id,match_id,pred_home_score,pred_away_score";
  const rows = (data ?? []).map(
    (p) =>
      `${p.player_id},${p.match_id},${p.pred_home_score},${p.pred_away_score}`
  );
  return [header, ...rows].join("\n");
}

export async function adminAddTeamAction(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = getSupabase();

  await supabase.from("teams").insert({
    name: formData.get("name") as string,
    short_name: formData.get("short_name") as string,
    fifa_code: formData.get("fifa_code") as string,
    flag_emoji: formData.get("flag_emoji") as string,
    group_letter: (formData.get("group_letter") as string) || null,
  });

  await logAudit(admin.id, "add_team", {});
  revalidatePath("/admin");
  return { success: true };
}
