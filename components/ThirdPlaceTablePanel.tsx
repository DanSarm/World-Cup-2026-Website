"use client";

import { useMemo, useState } from "react";
import { buildThirdPlaceTable } from "@/lib/knockoutBracket";
import {
  buildPickScoreMap,
  type PickScore,
} from "@/lib/groupStandings";
import type { Match, MatchPrediction } from "@/lib/types";
import { hasSavedPick } from "@/lib/pickUtils";
import { TeamFlag } from "./Flag";
import { TeamCode } from "./TeamCode";

interface ThirdPlaceTablePanelProps {
  matches: Match[];
  predictions: MatchPrediction[];
}

export function ThirdPlaceTablePanel({
  matches,
  predictions,
}: ThirdPlaceTablePanelProps) {
  const [expanded, setExpanded] = useState(true);

  const savedMap = useMemo(() => {
    const map = new Map<string, PickScore>();
    for (const p of predictions) {
      if (!hasSavedPick(p)) continue;
      map.set(p.match_id, {
        home: p.pred_home_score,
        away: p.pred_away_score,
      });
    }
    return map;
  }, [predictions]);

  const pickScores = useMemo(
    () => buildPickScoreMap(matches, savedMap, new Map()),
    [matches, savedMap]
  );

  const table = useMemo(
    () => buildThirdPlaceTable(matches, pickScores),
    [matches, pickScores]
  );

  if (table.entries.length === 0) return null;

  return (
    <section className="card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-usa text-sm uppercase tracking-wide">
          3rd place
        </h2>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-ink-faint hover:text-ink shrink-0"
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>

      {expanded && (
        <ul className="space-y-1.5">
          {table.entries.map((entry) => (
            <li
              key={entry.groupLetter}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${
                entry.qualifies
                  ? "bg-mexico/[0.06]"
                  : "opacity-50"
              }`}
            >
              <span className="w-4 tabular-nums font-bold text-ink-faint shrink-0">
                {entry.rank}
              </span>
              <TeamFlag team={entry.team} size="sm" />
              <TeamCode
                code={entry.team.fifa_code}
                className="flex-1 min-w-0 truncate text-sm tracking-normal text-ink"
              />
              <span className="text-ink-faint shrink-0">{entry.groupLetter}</span>
              <span className="tabular-nums font-semibold w-4 text-right shrink-0">
                {entry.points}
              </span>
              <span
                className={`tabular-nums w-6 text-right shrink-0 ${
                  entry.goalDiff > 0
                    ? "text-mexico"
                    : entry.goalDiff < 0
                      ? "text-canada"
                      : "text-ink-faint"
                }`}
              >
                {entry.goalDiff > 0 ? `+${entry.goalDiff}` : entry.goalDiff}
              </span>
              <span
                className={`w-7 text-right text-[9px] font-bold uppercase shrink-0 ${
                  entry.qualifies ? "text-mexico" : "text-canada"
                }`}
              >
                {entry.qualifies ? "In" : "Out"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
