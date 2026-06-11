"use client";

import { useMemo } from "react";
import type { CommunityMatchPick } from "@/lib/data";
import type { Match, MatchPrediction } from "@/lib/types";
import type { ScoringConfig } from "@/lib/scoringConfig";
import { MatchCard } from "./MatchCard";
import { MatchCommunityPicks } from "./MatchCommunityPicks";
import {
  mergeLiveMatchFromPayload,
  useLiveRefresh,
} from "@/lib/hooks/useLiveRefresh";
import {
  hasDisplayableLiveScore,
  isMatchInPlayWindow,
  isMatchLive,
} from "@/lib/matchLive";
import { canPickMatch } from "@/lib/utils";
import { hasSavedPick } from "@/lib/pickUtils";
import { UrgentPill } from "./UrgentPill";

interface HomeFeaturedMatchSectionProps {
  match: Match;
  prediction?: MatchPrediction | null;
  picks: CommunityMatchPick[];
  currentPlayerId: string;
  scoringConfig: ScoringConfig;
  /** Override section heading (e.g. "Next game", "Up next"). */
  sectionLabel?: string;
  totalPlayers?: number;
}

export function HomeFeaturedMatchSection({
  match: initialMatch,
  prediction,
  picks,
  currentPlayerId,
  scoringConfig,
  sectionLabel,
  totalPlayers,
}: HomeFeaturedMatchSectionProps) {
  const pollLive =
    isMatchLive(initialMatch) || isMatchInPlayWindow(initialMatch);
  const { data } = useLiveRefresh(pollLive);

  const match = useMemo(
    () => mergeLiveMatchFromPayload(initialMatch, data),
    [initialMatch, data]
  );

  const showingLiveScore = hasDisplayableLiveScore(match);
  const isLive = isMatchLive(match);
  const needsPick = canPickMatch(match) && !hasSavedPick(prediction);
  const heading =
    sectionLabel ?? (showingLiveScore || isLive ? "Live now" : "Upcoming game");

  const mostPickedScore = useMemo(() => {
    if (!picks.length) return null;
    const counts = new Map<string, number>();
    for (const p of picks) {
      const key = `${p.predHomeScore}–${p.predAwayScore}`;
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
  }, [picks]);

  return (
    <section className="card p-0 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-ink/5 bg-cream/30">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-usa uppercase tracking-wide">
            {heading}
          </h2>
          {needsPick && <UrgentPill />}
        </div>
        <p className="text-xs text-ink-muted mt-0.5">
          {showingLiveScore || isLive
            ? "Live score updates on a schedule · standings reflect the current score"
            : isMatchInPlayWindow(match)
              ? "Waiting for live score sync…"
              : "Make your pick, then see what everyone else is going with"}
        </p>
      </div>
      <MatchCard
        match={match}
        prediction={prediction}
        scoringConfig={scoringConfig}
        showPickCountdown={!showingLiveScore && !isLive && !isMatchInPlayWindow(match)}
        embedded
        mostPickedScore={showingLiveScore || isLive ? null : mostPickedScore}
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
    </section>
  );
}
