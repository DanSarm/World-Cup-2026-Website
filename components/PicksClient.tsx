"use client";

import { useState, useMemo } from "react";
import { PicksMatchCard } from "./PicksMatchCard";
import type { CommunityMatchPick } from "@/lib/data";
import { usePicksRefresh } from "@/lib/hooks/usePicksRefresh";
import { PageHeader } from "./PageHeader";
import {
  groupMatchesForPicks,
  filterSections,
  picksProgress,
  type PicksFilter,
} from "@/lib/picksGrouping";
import type { Match, MatchPrediction, Team, TournamentPodiumPrediction } from "@/lib/types";
import type { ScoringConfig } from "@/lib/scoringConfig";
import { canPickMatch } from "@/lib/utils";
import { hasSavedPick } from "@/lib/pickUtils";
import { TournamentPodiumCard } from "./TournamentPodiumCard";

interface PicksClientProps {
  matches: Match[];
  predictions: MatchPrediction[];
  scoringConfig: ScoringConfig;
  teams: Team[];
  myPodium?: TournamentPodiumPrediction | null;
  podiumLocked: boolean;
  worldCupKickoff: string | null;
  currentPlayerId: string;
  totalPlayers: number;
  communityPicksByMatchId: Record<string, CommunityMatchPick[]>;
  communityPickCountsByMatchId: Record<string, number>;
}

const FILTERS: { key: PicksFilter; label: string }[] = [
  { key: "need", label: "Need Pick" },
  { key: "past", label: "Finished" },
  { key: "picked", label: "Picked" },
  { key: "all", label: "All" },
];

export function PicksClient({
  matches,
  predictions,
  scoringConfig,
  teams,
  myPodium,
  podiumLocked,
  worldCupKickoff,
  currentPlayerId,
  totalPlayers,
  communityPicksByMatchId,
  communityPickCountsByMatchId,
}: PicksClientProps) {
  const [filter, setFilter] = useState<PicksFilter>("need");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const { data: snapshot, refresh } = usePicksRefresh(true);

  const liveMatches = snapshot?.matches ?? matches;
  const livePredictions = snapshot?.predictions ?? predictions;
  const liveCommunityPicks =
    snapshot?.communityPicksByMatchId ?? communityPicksByMatchId;
  const liveCommunityPickCounts =
    snapshot?.communityPickCountsByMatchId ?? communityPickCountsByMatchId;
  const liveTotalPlayers = snapshot?.totalPlayers ?? totalPlayers;

  const predMap = useMemo(
    () => new Map(livePredictions.map((p) => [p.match_id, p])),
    [livePredictions]
  );

  const teamMatches = useMemo(() => {
    if (!teamFilter) return liveMatches;
    return liveMatches.filter(
      (m) => m.home_team_id === teamFilter || m.away_team_id === teamFilter
    );
  }, [liveMatches, teamFilter]);

  const sections = useMemo(
    () => groupMatchesForPicks(teamMatches),
    [teamMatches]
  );
  const filtered = useMemo(
    () => filterSections(sections, filter, predMap),
    [sections, filter, predMap]
  );
  const progress = useMemo(
    () => picksProgress(liveMatches, predMap),
    [liveMatches, predMap]
  );

  const openSaved = liveMatches.filter(
    (m) => canPickMatch(m) && hasSavedPick(predMap.get(m.id))
  ).length;
  const pct =
    progress.pickable > 0
      ? Math.round((openSaved / progress.pickable) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Picks"
        subtitle="Pick scores before kickoff · Every game counts"
      />

      <TournamentPodiumCard
        teams={teams}
        myPodium={myPodium}
        locked={podiumLocked}
        worldCupKickoff={worldCupKickoff}
      />

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

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          aria-label="Filter by team"
          className={`filter-pill ml-auto shrink-0 cursor-pointer appearance-none ${teamFilter ? "filter-pill-active" : ""}`}
        >
          <option value="" className="bg-white text-black">
            🌍 All teams
          </option>
          {[...teams]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => (
              <option key={t.id} value={t.id} className="bg-white text-black">
                {t.flag_emoji} {t.name}
              </option>
            ))}
        </select>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {section.matches.map((m) => (
                <PicksMatchCard
                  key={m.id}
                  match={m}
                  prediction={predMap.get(m.id)}
                  scoringConfig={scoringConfig}
                  picks={liveCommunityPicks[m.id] ?? []}
                  currentPlayerId={currentPlayerId}
                  totalPlayers={liveTotalPlayers}
                  predictedCount={liveCommunityPickCounts[m.id]}
                  onPickSaved={refresh}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
