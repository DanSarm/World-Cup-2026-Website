"use client";

import { useMemo } from "react";
import type { CommunityMatchPick } from "@/lib/data";
import type { Match, MatchPrediction } from "@/lib/types";
import type { ScoringConfig } from "@/lib/scoringConfig";
import { MatchCard } from "./MatchCard";
import { MatchCommunityPicks } from "./MatchCommunityPicks";
import {
  hasDisplayableLiveScore,
  isMatchInPlayWindow,
  isMatchLive,
} from "@/lib/matchLive";

interface PicksMatchCardProps {
  match: Match;
  prediction?: MatchPrediction | null;
  picks: CommunityMatchPick[];
  currentPlayerId: string;
  scoringConfig: ScoringConfig;
  totalPlayers: number;
  onPickSaved?: () => void;
}

function mostPickedFromCommunityPicks(
  picks: CommunityMatchPick[]
): { score: string; percent: number } | null {
  if (!picks.length) return null;

  const counts = new Map<string, number>();
  for (const pick of picks) {
    const key = `${pick.predHomeScore}–${pick.predAwayScore}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let bestScore: string | null = null;
  let bestCount = 0;
  for (const [score, count] of counts) {
    if (count > bestCount) {
      bestScore = score;
      bestCount = count;
    }
  }

  if (!bestScore) return null;
  return {
    score: bestScore,
    percent: Math.round((bestCount / picks.length) * 100),
  };
}

export function PicksMatchCard({
  match,
  prediction,
  picks,
  currentPlayerId,
  scoringConfig,
  totalPlayers,
  onPickSaved,
}: PicksMatchCardProps) {
  const showingLiveScore = hasDisplayableLiveScore(match);
  const isLive = isMatchLive(match);
  const mostPickedScore = useMemo(() => {
    if (showingLiveScore || isLive) return null;
    return mostPickedFromCommunityPicks(picks);
  }, [picks, showingLiveScore, isLive]);

  return (
    <div className="card p-0 overflow-hidden h-fit w-full">
      <MatchCard
        match={match}
        prediction={prediction}
        scoringConfig={scoringConfig}
        showPickCountdown={
          !showingLiveScore && !isLive && !isMatchInPlayWindow(match)
        }
        embedded
        mostPickedScore={mostPickedScore}
        onPickSaved={onPickSaved}
      />
      <MatchCommunityPicks
        match={match}
        picks={picks}
        currentPlayerId={currentPlayerId}
        scoringConfig={scoringConfig}
        embedded
        showLivePoints={showingLiveScore || isLive}
        totalPlayers={totalPlayers}
      />
    </div>
  );
}
