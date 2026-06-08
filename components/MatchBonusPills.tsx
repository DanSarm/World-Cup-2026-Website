import { getBonusPills, hasAnyBonus } from "@/lib/matchBonuses";
import type { Match } from "@/lib/types";

export function MatchBonusPills({ match }: { match: Match }) {
  const pills = getBonusPills(match);
  if (!hasAnyBonus(match)) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <span key={pill.label} className="bonus-pill">
          {pill.label}
        </span>
      ))}
    </div>
  );
}
