"use client";

import { useMemo } from "react";
import type { CommunityMatchPick } from "@/lib/types";
import type { Match, MatchPrediction } from "@/lib/types";
import type { ScoringConfig } from "@/lib/scoringConfig";
import { MatchCard } from "./MatchCard";
import { MatchCommunityPicks } from "./MatchCommunityPicks";
import {
  hasDisplayableLiveScore,
  isMatchDecidedForScoring,
  isMatchInPlayWindow,
  isMatchLive,
} from "@/lib/matchLive";
import { canRevealOtherPlayersPicks } from "@/lib/pickVisibility";

interface PicksMatchCardProps {
  match: Match;
  prediction?: MatchPrediction | null;
  picks: CommunityMatchPick[];
  currentPlayerId: string;
  scoringConfig: ScoringConfig;
  totalPlayers: number;
  predictedCount?: number;
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
  predictedCount,
  onPickSaved,
}: PicksMatchCardProps) {
  const showingLiveScore = hasDisplayableLiveScore(match);
  const isLive = isMatchLive(match);
  const matchDecided = isMatchDecidedForScoring(match);
  const picksRevealed = canRevealOtherPlayersPicks(match);
  const mostPickedScore = useMemo(() => {
    if (!picksRevealed || showingLiveScore || isLive || matchDecided) return null;
    return mostPickedFromCommunityPicks(picks);
  }, [picks, picksRevealed, showingLiveScore, isLive, matchDecided]);

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
        showLivePoints={showingLiveScore || isLive || matchDecided}
        totalPlayers={totalPlayers}
        predictedCount={predictedCount}
      />
    </div>
  );
}
