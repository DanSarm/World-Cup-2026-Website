"use client";

import { PushNotificationManager } from "@/components/PushNotificationManager";
import { usePicksRefresh } from "@/lib/hooks/usePicksRefresh";
import { useScheduledPickReminders } from "@/lib/hooks/useScheduledPickReminders";
import type { PickScheduleItem } from "@/lib/pickReminders";

interface NotificationProviderProps {
  enabled: boolean;
}

const EMPTY_SCHEDULES: PickScheduleItem[] = [];

export function NotificationProvider({ enabled }: NotificationProviderProps) {
  const { data } = usePicksRefresh(enabled);
  useScheduledPickReminders(data?.pickSchedules ?? EMPTY_SCHEDULES);

  if (!enabled) return null;

  return (
    <PushNotificationManager
      pickReminder={data?.pickReminder ?? null}
    />
  );
}
