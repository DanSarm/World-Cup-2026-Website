"use client";

import dynamic from "next/dynamic";

const NotificationProvider = dynamic(
  () =>
    import("@/components/NotificationProvider").then(
      (m) => m.NotificationProvider
    ),
  { ssr: false }
);

export function NotificationsSlot({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div className="max-w-2xl mx-auto">
      <NotificationProvider enabled={enabled} />
    </div>
  );
}
