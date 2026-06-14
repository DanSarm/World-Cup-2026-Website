"use client";

import { useEffect, useState } from "react";
import { ClientErrorBoundary } from "@/components/ClientErrorBoundary";
import { NotificationProvider } from "@/components/NotificationProvider";

/**
 * Notifications load after hydration so iOS Safari finishes painting the page
 * first and a notification failure cannot block the main UI.
 */
export function NotificationsSlot({ enabled }: { enabled: boolean }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!enabled || !ready) return null;

  return (
    <ClientErrorBoundary silent>
      <div className="max-w-2xl mx-auto">
        <NotificationProvider enabled={enabled} />
      </div>
    </ClientErrorBoundary>
  );
}
