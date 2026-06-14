"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PickReminderPayload } from "@/lib/pickReminders";
import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageSet,
} from "@/lib/safeStorage";
import { APP_ICON_PATH } from "@/lib/site";

const DISMISS_KEY = "notifications-prompt-dismissed";
const SUBSCRIBED_KEY = "notifications-push-subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function supportsNotifications(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

interface PushNotificationManagerProps {
  pickReminder?: PickReminderPayload | null;
}

export function PushNotificationManager({
  pickReminder,
}: PushNotificationManagerProps) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pushConfigured, setPushConfigured] = useState(false);
  const shownTagsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!supportsNotifications()) return;

    const dismissed = safeLocalStorageGet(DISMISS_KEY) === "1";
    const subscribed = safeLocalStorageGet(SUBSCRIBED_KEY) === "1";
    if (subscribed || Notification.permission === "granted") {
      setVisible(false);
    } else if (!dismissed && Notification.permission === "default") {
      setVisible(true);
    }

    void fetch("/api/push/vapid-public-key", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { configured?: boolean }) => {
        setPushConfigured(Boolean(json.configured));
      })
      .catch(() => {
        setPushConfigured(false);
      });
  }, []);

  useEffect(() => {
    if (!pickReminder || !supportsNotifications()) return;
    if (Notification.permission !== "granted") return;
    if (shownTagsRef.current.has(pickReminder.tag)) return;
    if (safeSessionStorageGet(pickReminder.tag) === "1") return;

    try {
      const notification = new Notification(pickReminder.title, {
        body: pickReminder.body,
        icon: APP_ICON_PATH,
        tag: pickReminder.tag,
      });
      notification.onclick = () => {
        window.focus();
        window.location.href = pickReminder.url;
        notification.close();
      };
      shownTagsRef.current.add(pickReminder.tag);
      safeSessionStorageSet(pickReminder.tag, "1");
    } catch {
      /* ignore blocked notifications */
    }
  }, [pickReminder]);

  const enableReminders = useCallback(async () => {
    if (!supportsNotifications()) {
      setStatus("Notifications are not supported in this browser.");
      return;
    }

    setBusy(true);
    setStatus(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("Permission denied. Enable notifications in browser settings.");
        return;
      }

      if (!pushConfigured) {
        setStatus("In-app reminders enabled while this tab is open.");
        setVisible(false);
        return;
      }

      const keyRes = await fetch("/api/push/vapid-public-key", {
        cache: "no-store",
      });
      const keyJson = (await keyRes.json()) as {
        configured?: boolean;
        publicKey?: string | null;
      };

      if (!keyJson.configured || !keyJson.publicKey) {
        setStatus("In-app reminders enabled while this tab is open.");
        setVisible(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            keyJson.publicKey
          ) as BufferSource,
        });
      }

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Invalid push subscription");
      }

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
        }),
      });

      if (!saveRes.ok) {
        const err = (await saveRes.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to save subscription");
      }

      safeLocalStorageSet(SUBSCRIBED_KEY, "1");
      setVisible(false);
      setStatus(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not enable reminders";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }, [pushConfigured]);

  const dismiss = useCallback(() => {
    safeLocalStorageSet(DISMISS_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) {
    if (
      status &&
      supportsNotifications() &&
      Notification.permission === "denied"
    ) {
      return (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {status}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-950/40 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">Notifications</p>
          <p className="mt-1 text-sm text-white/70">
            Free alerts for pick reminders, exact scores, rank changes, and more.
            Works in Chrome, Edge, and on iPhone when added to Home Screen.
          </p>
          {status && (
            <p className="mt-2 text-sm text-amber-200">{status}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void enableReminders()}
            disabled={busy}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
          >
            {busy ? "Enabling…" : "Enable notifications"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
