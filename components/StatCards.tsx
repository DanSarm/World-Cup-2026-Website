import { StatCard } from "./PrizeCard";

interface StatCardsProps {
  mostPoints: { name: string; points: number } | null;
  mostExactScores: { name: string; count: number } | null;
  mostMiraclePoints: { name: string; points: number } | null;
  bestPerfectDay: { name: string; count: number } | null;
  biggestMover: { name: string; delta: number } | null;
}

export function StatCards({
  mostPoints,
  mostExactScores,
  mostMiraclePoints,
  bestPerfectDay,
  biggestMover,
}: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        icon="🏆"
        label="Most Points"
        value={
          mostPoints ? `${mostPoints.name} (${mostPoints.points})` : "—"
        }
      />
      <StatCard
        icon="🎯"
        label="Most Exact Scores"
        value={
          mostExactScores
            ? `${mostExactScores.name} (${mostExactScores.count})`
            : "—"
        }
      />
      <StatCard
        icon="🔥"
        label="Most Miracle Points"
        value={
          mostMiraclePoints
            ? `${mostMiraclePoints.name} (${mostMiraclePoints.points})`
            : "—"
        }
      />
      <StatCard
        icon="🎉"
        label="Best Perfect Day"
        value={
          bestPerfectDay
            ? `${bestPerfectDay.name} (${bestPerfectDay.count})`
            : "—"
        }
      />
      <StatCard
        icon="🚀"
        label="Biggest Mover"
        value={
          biggestMover
            ? `${biggestMover.name} (+${biggestMover.delta})`
            : "—"
        }
      />
    </div>
  );
}
