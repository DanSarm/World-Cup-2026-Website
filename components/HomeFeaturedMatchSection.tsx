"use client";

import { useMemo } from "react";
import type { CommunityMatchPick } from "@/lib/data";
import type { Match, MatchPrediction } from "@/lib/types";
import type { ScoringConfig } from "@/lib/scoringConfig";
import { MatchCard } from "./MatchCard";
import { MatchCommunityPicks } from "./MatchCommunityPicks";
import {
  mergeLiveMatch,
  useLiveRefresh,
} from "@/lib/hooks/useLiveRefresh";
import { isMatchInPlayWindow, isMatchLive } from "@/lib/matchLive";

interface HomeFeaturedMatchSectionProps {
  match: Match;
  prediction?: MatchPrediction | null;
  picks: CommunityMatchPick[];
  currentPlayerId: string;
  scoringConfig: ScoringConfig;
}

export function HomeFeaturedMatchSection({
  match: initialMatch,
  prediction,
  picks,
  currentPlayerId,
  scoringConfig,
}: HomeFeaturedMatchSectionProps) {
  const pollLive =
    isMatchLive(initialMatch) || isMatchInPlayWindow(initialMatch);
  const { data } = useLiveRefresh(pollLive);

  const match = useMemo(
    () => mergeLiveMatch(initialMatch, data?.liveMatch ?? undefined),
    [initialMatch, data?.liveMatch]
  );

  const isLive = isMatchLive(match);

  return (
    <section className="card p-0 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-ink/5 bg-cream/30">
        <h2 className="text-sm font-bold text-usa uppercase tracking-wide">
          {isLive ? "Live now" : "Upcoming game"}
        </h2>
        <p className="text-xs text-ink-muted mt-0.5">
          {isLive
            ? "Live score updates every ~10 minutes · standings reflect the current score"
            : "Make your pick, then see what everyone else is going with"}
        </p>
      </div>
      <MatchCard
        match={match}
        prediction={prediction}
        scoringConfig={scoringConfig}
        showPickCountdown={!isLive}
        embedded
      />
      <MatchCommunityPicks
        match={match}
        picks={picks}
        currentPlayerId={currentPlayerId}
        scoringConfig={scoringConfig}
        embedded
        showLivePoints={isLive}
      />
    </section>
  );
}
