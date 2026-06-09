import { StatCard } from "./PrizeCard";

interface StatCardsProps {
  mostPoints: { name: string; points: number } | null;
  mostExactScores: { name: string; count: number } | null;
  mostMiraclePoints: { name: string; points: number } | null;
  bestPerfectDay: { name: string; count: number } | null;
}

export function StatCards({
  mostPoints,
  mostExactScores,
  mostMiraclePoints,
  bestPerfectDay,
}: StatCardsProps) {
  const cards = [
    {
      icon: "🏆",
      label: "Most points",
      value: mostPoints ? `${mostPoints.name} · ${mostPoints.points}` : "—",
    },
    {
      icon: "🎯",
      label: "Most exact scores",
      value: mostExactScores
        ? `${mostExactScores.name} · ${mostExactScores.count}`
        : "—",
    },
    {
      icon: "🔥",
      label: "Most bonus pts",
      value: mostMiraclePoints
        ? `${mostMiraclePoints.name} · ${mostMiraclePoints.points}`
        : "—",
    },
    {
      icon: "🎉",
      label: "Best perfect day",
      value: bestPerfectDay
        ? `${bestPerfectDay.name} · ${bestPerfectDay.count}`
        : "—",
    },
  ];

  return (
    <section className="space-y-2">
      <h2 className="section-title px-0.5">Highlights</h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
          />
        ))}
      </div>
    </section>
  );
}
