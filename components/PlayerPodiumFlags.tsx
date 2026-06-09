import { TeamFlag } from "./Flag";
import type { PlayerPodiumDisplay } from "@/lib/types";
import { hasPodiumDisplay } from "@/lib/podiumDisplay";
import type { FlagSize } from "@/lib/flags";

interface PlayerPodiumFlagsProps {
  picks?: PlayerPodiumDisplay | null;
  fallbackEmoji?: string;
  size?: FlagSize;
  className?: string;
}

export function PlayerPodiumFlags({
  picks,
  fallbackEmoji = "⚽",
  size = "xs",
  className = "",
}: PlayerPodiumFlagsProps) {
  if (!hasPodiumDisplay(picks)) {
    return (
      <span
        className={`inline-flex w-7 shrink-0 items-center justify-center text-base ${className}`}
        aria-hidden
      >
        {fallbackEmoji}
      </span>
    );
  }

  const slots = [
    { team: picks.first, label: "1st place" },
    { team: picks.second, label: "2nd place" },
    { team: picks.third, label: "3rd place" },
  ];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 ${className}`}
      title="Podium picks"
    >
      {slots.map(({ team, label }) => (
        <TeamFlag key={label} team={team} size={size} />
      ))}
    </span>
  );
}
