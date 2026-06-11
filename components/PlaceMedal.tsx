import { WORLD_CUP_TROPHY_PATH } from "@/lib/site";

export type PlaceTier = "first" | "second" | "third";

type TrophySize = "podium" | "leaderboard" | "leaderboardHero" | "compact";

const EMOJI: Record<"second" | "third", string> = {
  second: "🥈",
  third: "🥉",
};

export function PlaceMedal({
  tier,
  trophySize = "leaderboard",
  className = "",
}: {
  tier: PlaceTier;
  trophySize?: TrophySize;
  className?: string;
}) {
  if (tier === "first") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={WORLD_CUP_TROPHY_PATH}
        alt=""
        aria-hidden
        className={`place-medal-trophy place-medal-trophy--${trophySize} ${className}`.trim()}
      />
    );
  }

  return (
    <span
      className={`place-medal-emoji place-medal-emoji--${tier} ${className}`.trim()}
      aria-hidden
    >
      {EMOJI[tier]}
    </span>
  );
}

export function RankMedal({
  rank,
  trophySize = "leaderboard",
  className = "",
}: {
  rank: number;
  trophySize?: TrophySize;
  className?: string;
}) {
  if (rank === 1) {
    return (
      <PlaceMedal tier="first" trophySize={trophySize} className={className} />
    );
  }
  if (rank === 2) {
    return <PlaceMedal tier="second" className={className} />;
  }
  if (rank === 3) {
    return <PlaceMedal tier="third" className={className} />;
  }
  return <>{rank}</>;
}
