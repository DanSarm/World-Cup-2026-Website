import { TeamFlag } from "./Flag";
import { TeamCode } from "./TeamCode";
import { tournamentPlacePoints } from "@/lib/tournamentValue";
import type { ChampionOddsRow } from "@/lib/odds/championOdds";

interface ChampionOddsPanelProps {
  entries: ChampionOddsRow[];
}

function formatWinChance(probability: number): string {
  if (probability >= 0.1) return `${Math.round(probability * 100)}%`;
  if (probability >= 0.01) return `${(probability * 100).toFixed(1)}%`;
  return "<1%";
}

export function ChampionOddsPanel({ entries }: ChampionOddsPanelProps) {
  const withOdds = entries.filter((entry) => entry.impliedProbability != null);

  return (
    <aside className="card p-0 overflow-hidden flex flex-col h-full max-h-full min-h-0 w-full">
      <div className="px-4 py-3 border-b border-ink/5 bg-cream/30 shrink-0">
        <h2 className="text-sm font-bold text-usa uppercase tracking-wide">
          To win it all
        </h2>
        <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">
          {withOdds.length > 0
            ? `${withOdds.length} teams · market win %`
            : "Winner odds from the market"}
        </p>
      </div>

      {withOdds.length === 0 ? (
        <p className="text-sm text-ink-faint text-center px-4 py-8 leading-snug">
          Winner odds aren&apos;t available yet
        </p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto podium-odds-scroll">
          <ol className="divide-y divide-ink/5">
            {entries.map((entry, index) => {
              const championPts = tournamentPlacePoints(entry.team, "champion");
              return (
                <li
                  key={entry.team.id}
                  className="flex items-center gap-2 px-3 py-1.5"
                >
                  <span className="w-5 text-center text-[10px] font-bold text-ink-faint tabular-nums shrink-0">
                    {entry.impliedProbability != null ? index + 1 : "—"}
                  </span>
                  <TeamFlag team={entry.team} size="sm" />
                  <div className="flex-1 min-w-0">
                    <TeamCode
                      code={entry.team.fifa_code}
                      className="text-xs text-ink tracking-normal"
                    />
                  </div>
                  {championPts > 0 && (
                    <span
                      className="text-[11px] font-bold text-mexico tabular-nums shrink-0"
                      title="Points if picked as Champion and they win it all"
                    >
                      +{championPts} pts
                    </span>
                  )}
                  <span
                    className={`w-10 text-right text-[11px] font-semibold tabular-nums shrink-0 ${
                      entry.impliedProbability != null
                        ? "text-ink-muted"
                        : "text-ink-faint"
                    }`}
                  >
                    {entry.impliedProbability != null
                      ? formatWinChance(entry.impliedProbability)
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </aside>
  );
}
