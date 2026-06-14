import { formatMatchLabel } from "@/lib/pickReminders";
import type { Match } from "@/lib/types";
import type { AppNotificationPayload } from "./types";
import { notificationKey } from "./types";

export function buildExactScoreNotification(
  match: Match,
  points: number
): { dedupeKey: string; payload: AppNotificationPayload } {
  const label = formatMatchLabel(match);
  return {
    dedupeKey: notificationKey("exact_score", [match.id]),
    payload: {
      kind: "exact_score",
      title: "Exact score!",
      body: `${label} finished ${match.home_score}–${match.away_score}. You nailed it — +${points} pts.`,
      url: "/picks",
      tag: `exact-score-${match.id}`,
    },
  };
}

export function buildCorrectResultNotification(
  match: Match,
  points: number
): { dedupeKey: string; payload: AppNotificationPayload } {
  const label = formatMatchLabel(match);
  return {
    dedupeKey: notificationKey("correct_result", [match.id]),
    payload: {
      kind: "correct_result",
      title: "Correct pick",
      body: `${label} finished ${match.home_score}–${match.away_score}. Right result — +${points} pts.`,
      url: "/picks",
      tag: `correct-result-${match.id}`,
    },
  };
}

export function buildFireBonusNotification(
  match: Match,
  fireBonus: number
): { dedupeKey: string; payload: AppNotificationPayload } {
  const label = formatMatchLabel(match);
  return {
    dedupeKey: notificationKey("fire_bonus", [match.id]),
    payload: {
      kind: "fire_bonus",
      title: "Fire bonus!",
      body: `Exact score on ${label} — fire bonus +${fireBonus} pts.`,
      url: "/picks",
      tag: `fire-bonus-${match.id}`,
    },
  };
}

export function buildBigPointsNotification(
  match: Match,
  points: number
): { dedupeKey: string; payload: AppNotificationPayload } {
  const label = formatMatchLabel(match);
  return {
    dedupeKey: notificationKey("big_points", [match.id]),
    payload: {
      kind: "big_points",
      title: "Big points!",
      body: `+${points} pts on ${label}. Nice pick.`,
      url: "/leaderboard",
      tag: `big-points-${match.id}`,
    },
  };
}

export function buildRankUpNotification(
  match: Match,
  newRank: number,
  spots: number
): { dedupeKey: string; payload: AppNotificationPayload } {
  const label = formatMatchLabel(match);
  const spotWord = spots === 1 ? "spot" : "spots";
  return {
    dedupeKey: notificationKey("rank_up", [match.id]),
    payload: {
      kind: "rank_up",
      title: "You moved up!",
      body: `Up ${spots} ${spotWord} to #${newRank} after ${label}.`,
      url: "/leaderboard",
      tag: `rank-up-${match.id}`,
    },
  };
}

export function buildTopThreeNotification(
  match: Match,
  rank: number
): { dedupeKey: string; payload: AppNotificationPayload } {
  return {
    dedupeKey: notificationKey("top_three", [match.id]),
    payload: {
      kind: "top_three",
      title: "Top 3!",
      body: `You're #${rank} on the leaderboard after ${formatMatchLabel(match)}.`,
      url: "/leaderboard",
      tag: `top-three-${match.id}`,
    },
  };
}

export function buildLiveExactNotification(
  match: Match
): { dedupeKey: string; payload: AppNotificationPayload } {
  const label = formatMatchLabel(match);
  return {
    dedupeKey: notificationKey("live_exact", [match.id]),
    payload: {
      kind: "live_exact",
      title: "Live exact score",
      body: `${label} is ${match.home_score}–${match.away_score} — matches your pick right now.`,
      url: "/picks",
      tag: `live-exact-${match.id}`,
    },
  };
}
