import type { AppNotificationPayload } from "./types";
import {
  hasNotificationBeenSent,
  markNotificationSent,
} from "./dedupe";

export interface NotifyPlayerResult {
  sent: boolean;
  skipped?: "deduped" | "no_subscription" | "push_not_configured" | "failed";
}

export async function notifyPlayer(
  playerId: string,
  dedupeKey: string,
  payload: AppNotificationPayload
): Promise<NotifyPlayerResult> {
  const { isPushConfigured } = await import("@/lib/push/vapid");
  if (!isPushConfigured()) {
    return { sent: false, skipped: "push_not_configured" };
  }

  if (await hasNotificationBeenSent(playerId, dedupeKey)) {
    return { sent: false, skipped: "deduped" };
  }

  const { listPushSubscriptionsForPlayer, removePushSubscription } =
    await import("@/lib/push/subscriptions");
  const { sendPushNotification } = await import("@/lib/push/send");

  const subscriptions = await listPushSubscriptionsForPlayer(playerId);
  if (!subscriptions.length) {
    return { sent: false, skipped: "no_subscription" };
  }

  let delivered = false;
  for (const sub of subscriptions) {
    const result = await sendPushNotification(sub, payload);
    if (result.ok) {
      delivered = true;
      continue;
    }
    if (result.expired) {
      await removePushSubscription(sub.id);
    }
  }

  if (!delivered) {
    return { sent: false, skipped: "failed" };
  }

  await markNotificationSent(playerId, dedupeKey);
  return { sent: true };
}

export async function notifyPlayers(
  items: Array<{ playerId: string; dedupeKey: string; payload: AppNotificationPayload }>
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  for (const item of items) {
    const result = await notifyPlayer(item.playerId, item.dedupeKey, item.payload);
    if (result.sent) sent += 1;
    else skipped += 1;
  }
  return { sent, skipped };
}
