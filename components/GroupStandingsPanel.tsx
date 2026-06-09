"use client";

import { useMemo, useState } from "react";
import {
  buildPickScoreMap,
  computeGroupProjections,
  type GroupProjection,
  type PickScore,
} from "@/lib/groupStandings";
import { GROUP_LETTERS, type Match, type MatchPrediction } from "@/lib/types";
import { hasSavedPick } from "@/lib/pickUtils";
import { hasActualMatchResult } from "@/lib/matchResults";
import { TeamFlag } from "./Flag";
import { TeamCode } from "./TeamCode";

interface GroupStandingsPanelProps {
  matches: Match[];
  predictions: MatchPrediction[];
  draftPicks?: Map<string, PickScore>;
  highlightGroup?: string | null;
}

export function GroupStandingsPanel({
  matches,
  predictions,
  draftPicks = new Map(),
  highlightGroup,
}: GroupStandingsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<"all" | "started">("all");

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
    () => buildPickScoreMap(matches, savedMap, draftPicks),
    [matches, savedMap, draftPicks]
  );

  const groups = useMemo(
    () => computeGroupProjections(matches, pickScores),
    [matches, pickScores]
  );

  const visible = useMemo(
    () =>
      filter === "started"
        ? groups.filter((g) => g.picksApplied > 0)
        : groups,
    [groups, filter]
  );

  const totalPicks = groups.reduce((s, g) => s + g.picksApplied, 0);
  const totalGroupMatches = groups.reduce((s, g) => s + g.totalMatches, 0);
  const finalGroupResults = matches.filter(
    (m) => m.stage === "group" && hasActualMatchResult(m)
  ).length;

  if (!groups.length) return null;

  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-bold text-usa text-sm uppercase tracking-wide">
            Your group picture
          </h2>
          <p className="text-xs text-ink-muted leading-snug">
            Final scores update standings automatically · unplayed games use your
            picks
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-ink-faint hover:text-ink shrink-0"
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-ink-muted tabular-nums">
          {finalGroupResults > 0 && (
            <span>{finalGroupResults} final · </span>
          )}
          {totalPicks}/{totalGroupMatches} picks applied
        </span>
        <div className="flex gap-1">
          {(
            [
              { key: "all" as const, label: "All groups" },
              { key: "started" as const, label: "With picks" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`filter-pill text-[10px] py-1 px-2 ${
                filter === f.key ? "filter-pill-active" : ""
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visible.map((group) => (
            <GroupCard
              key={group.letter}
              group={group}
              highlighted={highlightGroup === group.letter}
            />
          ))}
          {visible.length === 0 && (
            <p className="text-sm text-ink-muted col-span-full text-center py-4">
              Pick a group-stage score to see standings here
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function GroupCard({
  group,
  highlighted,
}: {
  group: GroupProjection;
  highlighted: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 space-y-2 transition-shadow ${
        highlighted
          ? "border-gold bg-gold/5 ring-1 ring-gold/40"
          : "border-ink/10 bg-cream/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-ink">Group {group.letter}</span>
        <span className="text-[10px] text-ink-faint tabular-nums">
          {group.picksApplied}/{group.totalMatches}
        </span>
      </div>

      <div className="space-y-1">
        {group.rows.map((row) => (
          <div
            key={row.teamId}
            className="flex items-center gap-1.5 text-[11px] rounded-lg px-1.5 py-1"
          >
            <span className="w-4 text-ink-faint tabular-nums">{row.rank}</span>
            <TeamFlag team={row.team} size="sm" />
            <TeamCode code={row.team.fifa_code} className="flex-1 truncate text-sm tracking-normal text-ink" />
            <span className="tabular-nums text-ink-muted w-5 text-right">
              {row.points}
            </span>
            <span
              className={`tabular-nums w-7 text-right ${
                row.goalDiff > 0
                  ? "text-mexico"
                  : row.goalDiff < 0
                    ? "text-canada"
                    : "text-ink-faint"
              }`}
            >
              {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
            </span>
          </div>
        ))}
      </div>

      {group.picksApplied === 0 && (
        <p className="text-[10px] text-ink-faint text-center">No picks yet</p>
      )}
    </div>
  );
}

export function groupLettersWithMatches(matches: Match[]): string[] {
  return GROUP_LETTERS.filter((letter) =>
    matches.some((m) => m.stage === "group" && m.group_letter === letter)
  );
}
