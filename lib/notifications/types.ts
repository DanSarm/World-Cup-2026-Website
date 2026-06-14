export type NotificationKind =
  | "pick_reminder"
  | "exact_score"
  | "correct_result"
  | "fire_bonus"
  | "big_points"
  | "rank_up"
  | "live_exact"
  | "top_three";

export interface AppNotificationPayload {
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  tag: string;
}

export function notificationKey(kind: NotificationKind, parts: string[]): string {
  return `${kind}:${parts.join(":")}`;
}

/** All notification types the app can send (extensible registry). */
export const NOTIFICATION_CATALOG: Record<
  NotificationKind,
  { label: string; description: string }
> = {
  pick_reminder: {
    label: "Pick reminder",
    description: "15 minutes before kickoff if you have no pick saved",
  },
  exact_score: {
    label: "Exact score",
    description: "Your pick matched the final score exactly",
  },
  correct_result: {
    label: "Correct result",
    description: "You picked the right winner or draw",
  },
  fire_bonus: {
    label: "Fire bonus",
    description: "You earned the exact-score fire bonus",
  },
  big_points: {
    label: "Big points",
    description: "You earned 15+ points on a single match",
  },
  rank_up: {
    label: "Rank up",
    description: "You moved up the leaderboard after a result",
  },
  live_exact: {
    label: "Live exact",
    description: "The live score currently matches your pick exactly",
  },
  top_three: {
    label: "Top 3",
    description: "You moved into the top 3 on the leaderboard",
  },
};

export const BIG_POINTS_THRESHOLD = 15;
