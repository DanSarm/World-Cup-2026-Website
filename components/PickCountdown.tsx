"use client";

import { useEffect, useState } from "react";
import { parseISO } from "date-fns";

function getTimeLeft(kickoffAt: string | null): {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} | null {
  if (!kickoffAt) return null;
  const totalMs = parseISO(kickoffAt).getTime() - Date.now();
  if (totalMs <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
  const seconds = Math.floor((totalMs / 1000) % 60);
  return { totalMs, days, hours, minutes, seconds };
}

function formatCountdown(left: NonNullable<ReturnType<typeof getTimeLeft>>): string {
  if (left.days > 0) {
    return `${left.days}d ${left.hours}h`;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(left.hours)}:${pad(left.minutes)}:${pad(left.seconds)}`;
}

export function PickCountdownBadge({
  kickoffAt,
  label = "left",
  finished = false,
}: {
  kickoffAt: string | null;
  label?: string;
  finished?: boolean;
}) {
  const [left, setLeft] = useState<ReturnType<typeof getTimeLeft>>(null);

  useEffect(() => {
    if (finished) return;
    const tick = () => setLeft(getTimeLeft(kickoffAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kickoffAt, finished]);

  if (finished) {
    return (
      <div className="shrink-0 text-right leading-tight">
        <span className="text-base font-extrabold uppercase tracking-wide text-ink-faint tabular-nums">
          Finished
        </span>
      </div>
    );
  }

  if (!kickoffAt) {
    return (
      <div className="shrink-0 text-right leading-tight">
        <span className="text-base font-extrabold text-ink-faint tabular-nums">
          TBA
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </span>
      </div>
    );
  }

  if (left === null) {
    return (
      <div
        className="shrink-0 text-right leading-tight"
        title="Time left to pick"
        aria-hidden
      >
        <span className="text-base font-extrabold text-usa tabular-nums">
          --:--:--
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          left
        </span>
      </div>
    );
  }

  if (left.totalMs <= 0) {
    return (
      <div className="shrink-0 text-right leading-tight">
        <span className="text-base font-extrabold text-canada tabular-nums">
          Soon
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 text-right leading-tight" title="Time left to pick">
      <span className="text-base font-extrabold text-usa tabular-nums">
        {formatCountdown(left)}
      </span>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        left
      </span>
    </div>
  );
}
