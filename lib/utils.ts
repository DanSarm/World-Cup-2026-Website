import { formatInTimeZone } from "date-fns-tz";
import { isBefore, parseISO } from "date-fns";
import type { Match } from "./types";

const TZ = "America/New_York";

export function formatKickoff(kickoffAt: string | null): string {
  if (!kickoffAt) return "Time TBA";
  return formatInTimeZone(parseISO(kickoffAt), TZ, "MMM d · h:mm a");
}

export function formatDateHeader(kickoffAt: string | null): string {
  if (!kickoffAt) return "Date TBA";
  return formatInTimeZone(parseISO(kickoffAt), TZ, "EEEE, MMM d");
}

export function isMatchLocked(
  match: Pick<Match, "status" | "kickoff_at">
): boolean {
  if (match.status === "final") return true;
  if (match.status === "live") return true;
  if (match.status === "locked") return true;
  if (!match.kickoff_at) return false;
  return isBefore(parseISO(match.kickoff_at), new Date());
}

export function getLockStatus(match: Match): {
  label: string;
  variant: "open" | "soon" | "locked" | "live" | "final";
} {
  if (match.status === "final") {
    return { label: "Final", variant: "final" };
  }
  if (match.status === "live") {
    return { label: "Live", variant: "live" };
  }
  if (isMatchLocked(match)) {
    return { label: "Locked", variant: "locked" };
  }
  if (!match.kickoff_at) {
    return { label: "Open", variant: "open" };
  }
  return { label: "Locks at kickoff", variant: "soon" };
}

export function getTodayTomorrowKeys(): { today: string; tomorrow: string } {
  const now = new Date();
  const today = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = formatInTimeZone(tomorrowDate, TZ, "yyyy-MM-dd");
  return { today, tomorrow };
}

export function matchDateKey(kickoffAt: string | null): string {
  if (!kickoffAt) return "tba";
  return formatInTimeZone(parseISO(kickoffAt), TZ, "yyyy-MM-dd");
}

export function canPickMatch(match: Match): boolean {
  return !!(match.home_team_id && match.away_team_id && !isMatchLocked(match));
}

/** Earliest scheduled kickoff — countdown target for tournament-wide picks. */
export function getWorldCupKickoff(matches: Match[]): string | null {
  const kickoffs = matches
    .filter((m) => m.home_team_id && m.away_team_id && m.kickoff_at)
    .map((m) => m.kickoff_at!)
    .sort();
  return kickoffs[0] ?? null;
}

export function siteName(): string {
  return process.env.NEXT_PUBLIC_SITE_NAME ?? "Family Cup 2026";
}
