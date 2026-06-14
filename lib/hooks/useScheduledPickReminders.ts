"use client";

import { parseISO } from "date-fns";
import { useEffect, useRef } from "react";
import type { PickScheduleItem } from "@/lib/pickReminders";
import { PICK_REMINDER_MINUTES } from "@/lib/pickReminderConstants";

const SCHEDULED_PREFIX = "scheduled-pick:";

function showLocalNotification(item: PickScheduleItem) {
  if (typeof window === "undefined" || Notification.permission !== "granted") {
    return;
  }
  if (localStorage.getItem(`${SCHEDULED_PREFIX}${item.tag}`) === "1") return;

  try {
    const notification = new Notification(item.title, {
      body: item.body,
      icon: "/logo/clipart1360288.png",
      tag: item.tag,
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = item.url;
      notification.close();
    };
    localStorage.setItem(`${SCHEDULED_PREFIX}${item.tag}`, "1");
  } catch {
    /* ignore */
  }
}

/** Schedules local pick reminders on this device — no external cron. */
export function useScheduledPickReminders(items: PickScheduleItem[]) {
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Notification.permission !== "granted") return;

    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];

    for (const item of items) {
      const kickoff = parseISO(item.kickoffAt).getTime();
      const fireAt = kickoff - PICK_REMINDER_MINUTES * 60_000;
      const delay = fireAt - Date.now();
      if (delay <= 0) continue;
      if (localStorage.getItem(`${SCHEDULED_PREFIX}${item.tag}`) === "1") {
        continue;
      }

      const timerId = window.setTimeout(() => {
        showLocalNotification(item);
      }, delay);
      timersRef.current.push(timerId);
    }

    return () => {
      for (const id of timersRef.current) {
        window.clearTimeout(id);
      }
      timersRef.current = [];
    };
  }, [items]);
}
