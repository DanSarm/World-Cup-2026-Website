import webpush from "web-push";
import type { AppNotificationPayload } from "@/lib/notifications/types";
import type { PushSubscriptionRow } from "./subscriptions";
import { getVapidDetails } from "./vapid";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const details = getVapidDetails();
  if (!details) return false;
  webpush.setVapidDetails(
    details.subject,
    details.publicKey,
    details.privateKey
  );
  configured = true;
  return true;
}

export interface SendPushResult {
  ok: boolean;
  expired?: boolean;
  error?: string;
}

export async function sendPushNotification(
  row: PushSubscriptionRow,
  payload: AppNotificationPayload
): Promise<SendPushResult> {
  if (!ensureConfigured()) {
    return { ok: false, error: "push_not_configured" };
  }

  const subscription = {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag,
      })
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, expired: true };
    }

    const message = error instanceof Error ? error.message : "push_failed";
    console.error("sendPushNotification:", message);
    return { ok: false, error: message };
  }
}
