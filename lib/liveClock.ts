import type { Match } from "./types";

/** User-facing live match clock from ESPN (or similar feed). */

export function formatEspnLiveClock(status: {
  displayClock?: string;
  period?: number;
  type?: {
    state?: string;
    name?: string;
    description?: string;
    shortDetail?: string;
  };
} | null | undefined): string | null {
  if (!status?.type) return null;
  if (status.type.state !== "in") return null;

  const name = (status.type.name ?? "").toUpperCase();
  const desc = (status.type.description ?? "").toLowerCase();
  const short = (status.type.shortDetail ?? "").toUpperCase();
  const period = status.period ?? 0;

  if (
    name.includes("HALFTIME") ||
    desc.includes("halftime") ||
    short === "HT"
  ) {
    return "Half time";
  }

  const clock = status.displayClock?.trim();
  const clockLabel = clock && clock !== "0'" ? clock : null;

  if (
    name.includes("SHOOTOUT") ||
    name.includes("PENALT") ||
    desc.includes("penalt") ||
    desc.includes("shootout")
  ) {
    return "Penalties";
  }

  const isExtraTime =
    name.includes("EXTRA") ||
    desc.includes("extra time") ||
    period >= 3;

  if (isExtraTime) {
    if (clockLabel) return `ET ${clockLabel}`;
    return "Extra time";
  }

  if (clockLabel) return clockLabel;

  return null;
}

export function mergeLiveClocks(
  matches: Match[],
  clocks?: Record<string, string> | null
): Match[] {
  if (!clocks || Object.keys(clocks).length === 0) return matches;
  return matches.map((match) => {
    const clock = clocks[match.id];
    if (!clock) return match;
    return { ...match, live_clock_display: clock };
  });
}
