"use client";

import { PushNotificationManager } from "@/components/PushNotificationManager";
import { usePicksRefresh } from "@/lib/hooks/usePicksRefresh";
import { useScheduledPickReminders } from "@/lib/hooks/useScheduledPickReminders";

interface NotificationProviderProps {
  enabled: boolean;
}

export function NotificationProvider({ enabled }: NotificationProviderProps) {
  const { data } = usePicksRefresh(enabled);
  useScheduledPickReminders(data?.pickSchedules ?? []);

  if (!enabled) return null;

  return (
    <PushNotificationManager
      pickReminder={data?.pickReminder ?? null}
    />
  );
}
