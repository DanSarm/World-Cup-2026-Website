import { parseISO } from "date-fns";
import { getMatchesWithTeams, getPlayers, getPredictions } from "./data";
import { hasSavedPick } from "./pickUtils";
import { getSupabase } from "./supabaseServer";
import type { Match, MatchPrediction } from "./types";
import { canPickMatch } from "./utils";
import type { AppNotificationPayload } from "./notifications/types";
import { notificationKey } from "./notifications/types";

import { PICK_REMINDER_MINUTES, PICK_REMINDER_WINDOW_MINUTES } from "./pickReminderConstants";
export { PICK_REMINDER_MINUTES, PICK_REMINDER_WINDOW_MINUTES };

export interface PickReminderPayload extends AppNotificationPayload {
  matchId: string;
  minutesUntilKickoff: number;
}

export interface PickScheduleItem {
  matchId: string;
  kickoffAt: string;
  title: string;
  body: string;
  url: string;
  tag: string;
}

const REMINDER_THROTTLE_MS = 4 * 60 * 1000;
const SETTINGS_LAST_RUN_KEY = "pick_reminders_last_run_at";

export function minutesUntilKickoff(
  kickoffAt: string,
  now = Date.now()
): number {
  return (parseISO(kickoffAt).getTime() - now) / 60_000;
}

export function isInPickReminderWindow(
  kickoffAt: string,
  now = Date.now()
): boolean {
  const minutesUntil = minutesUntilKickoff(kickoffAt, now);
  const target = PICK_REMINDER_MINUTES;
  return (
    minutesUntil >= target - PICK_REMINDER_WINDOW_MINUTES &&
    minutesUntil <= target + PICK_REMINDER_WINDOW_MINUTES
  );
}

export function formatMatchLabel(match: Match): string {
  return `${match.home_label} vs ${match.away_label}`;
}

export function buildPickReminderPayload(
  match: Match,
  now = Date.now()
): PickReminderPayload {
  const label = formatMatchLabel(match);
  const minutesUntil = match.kickoff_at
    ? Math.round(minutesUntilKickoff(match.kickoff_at, now))
    : PICK_REMINDER_MINUTES;

  return {
    kind: "pick_reminder",
    matchId: match.id,
    title: "Pick reminder",
    body: `${label} kicks off in ~${minutesUntil} min — lock in your score.`,
    url: "/picks",
    tag: `pick-reminder-${match.id}`,
    minutesUntilKickoff: minutesUntil,
  };
}

function predictionsByPlayerAndMatch(
  predictions: MatchPrediction[]
): Map<string, Map<string, MatchPrediction>> {
  const byPlayer = new Map<string, Map<string, MatchPrediction>>();
  for (const prediction of predictions) {
    let byMatch = byPlayer.get(prediction.player_id);
    if (!byMatch) {
      byMatch = new Map();
      byPlayer.set(prediction.player_id, byMatch);
    }
    byMatch.set(prediction.match_id, prediction);
  }
  return byPlayer;
}

export function findMatchesInReminderWindow(
  matches: Match[],
  now = Date.now()
): Match[] {
  return matches.filter(
    (match) =>
      canPickMatch(match) &&
      match.kickoff_at &&
      isInPickReminderWindow(match.kickoff_at, now)
  );
}

export function findPickReminderForPlayer(
  matches: Match[],
  predictions: MatchPrediction[],
  now = Date.now()
): PickReminderPayload | null {
  const predByMatch = new Map(predictions.map((p) => [p.match_id, p]));

  for (const match of findMatchesInReminderWindow(matches, now).sort((a, b) =>
    (a.kickoff_at ?? "").localeCompare(b.kickoff_at ?? "")
  )) {
    if (hasSavedPick(predByMatch.get(match.id))) continue;
    return buildPickReminderPayload(match, now);
  }

  return null;
}

/** Upcoming matches the player can still pick — used for client-side scheduled reminders. */
export function findUpcomingPickSchedules(
  matches: Match[],
  predictions: MatchPrediction[],
  now = Date.now(),
  maxHoursAhead = 48
): PickScheduleItem[] {
  const predByMatch = new Map(predictions.map((p) => [p.match_id, p]));
  const maxMs = maxHoursAhead * 60 * 60 * 1000;

  return matches
    .filter((match) => {
      if (!canPickMatch(match) || !match.kickoff_at) return false;
      if (hasSavedPick(predByMatch.get(match.id))) return false;
      const kickoff = parseISO(match.kickoff_at).getTime();
      const reminderAt = kickoff - PICK_REMINDER_MINUTES * 60_000;
      return reminderAt > now && reminderAt - now <= maxMs;
    })
    .sort((a, b) => (a.kickoff_at ?? "").localeCompare(b.kickoff_at ?? ""))
    .map((match) => {
      const payload = buildPickReminderPayload(match, now);
      return {
        matchId: match.id,
        kickoffAt: match.kickoff_at!,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag,
      };
    });
}

async function getLastReminderRunAt(): Promise<number | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", SETTINGS_LAST_RUN_KEY)
    .maybeSingle();

  if (!data?.value) return null;
  const raw =
    typeof data.value === "string" ? data.value : JSON.stringify(data.value);
  const parsed = Date.parse(raw.replace(/^"|"$/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function setLastReminderRunAt(at: number): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("settings").upsert({
    key: SETTINGS_LAST_RUN_KEY,
    value: new Date(at).toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export interface ProcessPickRemindersResult {
  skipped: boolean;
  reason?: string;
  matchesChecked: number;
  remindersSent: number;
  remindersSkipped: number;
}

/** Piggybacks on app polls — no external cron required. */
export async function processPickReminders(options?: {
  now?: number;
}): Promise<ProcessPickRemindersResult> {
  const now = options?.now ?? Date.now();
  const lastRun = await getLastReminderRunAt();
  if (lastRun != null && now - lastRun < REMINDER_THROTTLE_MS) {
    return {
      skipped: true,
      reason: "throttled",
      matchesChecked: 0,
      remindersSent: 0,
      remindersSkipped: 0,
    };
  }

  const { isPushConfigured } = await import("./push/vapid");
  if (!isPushConfigured()) {
    await setLastReminderRunAt(now);
    return {
      skipped: true,
      reason: "push_not_configured",
      matchesChecked: 0,
      remindersSent: 0,
      remindersSkipped: 0,
    };
  }

  const [matches, predictions, players] = await Promise.all([
    getMatchesWithTeams(),
    getPredictions(),
    getPlayers(),
  ]);

  const dueMatches = findMatchesInReminderWindow(matches, now);
  await setLastReminderRunAt(now);

  if (dueMatches.length === 0) {
    return {
      skipped: false,
      matchesChecked: 0,
      remindersSent: 0,
      remindersSkipped: 0,
    };
  }

  const { notifyPlayer } = await import("./notifications/dispatch");
  const predByPlayer = predictionsByPlayerAndMatch(predictions);
  let remindersSent = 0;
  let remindersSkipped = 0;

  for (const match of dueMatches) {
    const payload = buildPickReminderPayload(match, now);
    const dedupeKey = notificationKey("pick_reminder", [match.id]);

    for (const player of players) {
      const playerPreds = predByPlayer.get(player.id);
      if (hasSavedPick(playerPreds?.get(match.id))) continue;

      const result = await notifyPlayer(player.id, dedupeKey, payload);
      if (result.sent) remindersSent += 1;
      else remindersSkipped += 1;
    }
  }

  return {
    skipped: false,
    matchesChecked: dueMatches.length,
    remindersSent,
    remindersSkipped,
  };
}

export function firePickReminders(): void {
  void processPickReminders().catch((error) => {
    console.error("processPickReminders:", error);
  });
}
