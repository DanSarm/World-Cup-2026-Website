import type { PlayerPodiumDisplay, PodiumTeamRef } from "@/lib/types";
import { Flag } from "./Flag";
import { PlaceMedal } from "./PlaceMedal";

interface ProfilePodiumShowcaseProps {
  podiumPicks: PlayerPodiumDisplay;
  championPoints: number;
  runnerUpPoints: number;
  thirdPoints: number;
  playerName: string;
  isOwnProfile?: boolean;
}

const SLOTS = [
  {
    tier: "second" as const,
    label: "Runner-up",
    teamKey: "second" as const,
    pointsKey: "runnerUp" as const,
  },
  {
    tier: "first" as const,
    label: "Champion",
    teamKey: "first" as const,
    pointsKey: "champion" as const,
  },
  {
    tier: "third" as const,
    label: "Third place",
    teamKey: "third" as const,
    pointsKey: "third" as const,
  },
];

function PodiumSlot({
  tier,
  label,
  team,
  points,
}: {
  tier: "first" | "second" | "third";
  label: string;
  team: PodiumTeamRef | null;
  points: number;
}) {
  const isChampion = tier === "first";

  return (
    <div className={`profile-podium-slot profile-podium-slot--${tier}`}>
      <div className="profile-podium-slot-top">
        <span className={`profile-podium-medal profile-podium-medal--${tier}`}>
          <PlaceMedal tier={tier} trophySize={isChampion ? "podium" : "compact"} />
        </span>
        {team ? (
          <>
            <div className={`profile-podium-flag profile-podium-flag--${tier}`}>
              <Flag fifaCode={team.fifa_code} size={isChampion ? "lg" : "md"} />
            </div>
            <p className={`profile-podium-team profile-podium-team--${tier}`}>
              {team.short_name || team.name}
            </p>
          </>
        ) : (
          <p className="profile-podium-empty">Not picked</p>
        )}
        <p className={`profile-podium-label profile-podium-label--${tier}`}>
          {label}
        </p>
        {points > 0 && (
          <span className={`profile-podium-pts profile-podium-pts--${tier}`}>
            +{points} pts
          </span>
        )}
      </div>
      <div
        className={`profile-podium-plinth profile-podium-plinth--${tier}`}
        aria-hidden
      />
    </div>
  );
}

export function ProfilePodiumShowcase({
  podiumPicks,
  championPoints,
  runnerUpPoints,
  thirdPoints,
  playerName,
  isOwnProfile = false,
}: ProfilePodiumShowcaseProps) {
  const pointsByKey = {
    champion: championPoints,
    runnerUp: runnerUpPoints,
    third: thirdPoints,
  };

  const pickedCount = [podiumPicks.first, podiumPicks.second, podiumPicks.third].filter(
    Boolean
  ).length;

  const subtitle = isOwnProfile
    ? pickedCount === 3
      ? "Full podium locked in"
      : `${pickedCount} of 3 podium picks`
    : "Tournament podium predictions";

  return (
    <section className="card profile-podium-showcase p-0 overflow-hidden">
      <header className="profile-podium-showcase-header">
        <p className="profile-podium-showcase-eyebrow">World Cup 2026</p>
        <h2 className="profile-podium-showcase-title">
          {playerName}&apos;s champions
        </h2>
        <p className="profile-podium-showcase-sub">{subtitle}</p>
      </header>

      <div className="profile-podium-stage">
        <div className="profile-podium-stage-glow" aria-hidden />
        <div className="profile-podium-row">
          {SLOTS.map((slot) => (
            <PodiumSlot
              key={slot.tier}
              tier={slot.tier}
              label={slot.label}
              team={podiumPicks[slot.teamKey]}
              points={pointsByKey[slot.pointsKey]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
