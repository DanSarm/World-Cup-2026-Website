"use client";

import { useState, useMemo, useCallback } from "react";
import { MatchCard } from "./MatchCard";
import { PageHeader } from "./PageHeader";
import { GroupStandingsPanel } from "./GroupStandingsPanel";
import {
  groupMatchesForPicks,
  filterSections,
  picksProgress,
  type PicksFilter,
} from "@/lib/picksGrouping";
import type { PickScore } from "@/lib/groupStandings";
import type { Match, MatchPrediction } from "@/lib/types";
import type { ScoringConfig } from "@/lib/scoringConfig";
import { canPickMatch } from "@/lib/utils";

interface PicksClientProps {
  matches: Match[];
  predictions: MatchPrediction[];
  scoringConfig: ScoringConfig;
}

const FILTERS: { key: PicksFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "need", label: "Need Pick" },
  { key: "saved", label: "Saved" },
  { key: "open", label: "Open" },
];

export function PicksClient({ matches, predictions, scoringConfig }: PicksClientProps) {
  const [filter, setFilter] = useState<PicksFilter>("all");
  const [draftPicks, setDraftPicks] = useState<Map<string, PickScore>>(
    () => new Map()
  );
  const [highlightGroup, setHighlightGroup] = useState<string | null>(null);

  const predMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions]
  );

  const handlePickChange = useCallback(
    (matchId: string, home: number, away: number) => {
      const match = matches.find((m) => m.id === matchId);
      if (match?.group_letter) setHighlightGroup(match.group_letter);

      setDraftPicks((prev) => {
        const next = new Map(prev);
        next.set(matchId, { home, away });
        return next;
      });
    },
    [matches]
  );

  const sections = useMemo(() => groupMatchesForPicks(matches), [matches]);
  const filtered = useMemo(
    () => filterSections(sections, filter, predMap),
    [sections, filter, predMap]
  );
  const progress = useMemo(
    () => picksProgress(matches, predMap),
    [matches, predMap]
  );

  const openSaved = matches.filter(
    (m) => canPickMatch(m) && predMap.has(m.id)
  ).length;
  const pct =
    progress.pickable > 0
      ? Math.round((openSaved / progress.pickable) * 100)
      : 0;

  const hasGroupStage = matches.some((m) => m.stage === "group");

  return (
    <div className="space-y-6">
      <PageHeader
        flags={["USA", "MEX", "CAN", "BRA"]}
        title="Picks"
        subtitle="Pick scores before kickoff · Every game counts"
      />

      {hasGroupStage && (
        <GroupStandingsPanel
          matches={matches}
          predictions={predictions}
          draftPicks={draftPicks}
          highlightGroup={highlightGroup}
        />
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-usa">Your Progress</span>
          <span className="text-sm font-semibold text-mexico">
            {openSaved} / {progress.pickable}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-ink-faint">
          <span>{progress.total} matches</span>
          <span>{progress.locked} locked</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`filter-pill ${filter === f.key ? "filter-pill-active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-10 space-y-2">
          <div className="text-4xl">🎉</div>
          <p className="font-bold text-usa">All caught up!</p>
          <p className="text-sm text-ink-muted">Try a different filter</p>
        </div>
      ) : (
        filtered.map((section) => (
          <section key={section.id} className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 px-0.5">
              <h2 className="section-title">{section.title}</h2>
              {section.subtitle && (
                <span className="text-xs text-on-dark-muted">{section.subtitle}</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {section.matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  prediction={predMap.get(m.id)}
                  scoringConfig={scoringConfig}
                  onPickChange={m.stage === "group" ? handlePickChange : undefined}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
