"use client";

import { useState, type ReactNode } from "react";
import { hasDisplayableLiveScore } from "@/lib/matchLive";
import type { CommunityMatchPick } from "@/lib/data";
import {
  isPickExactImpossible,
  isPickLiveEliminated,
  withLiveFormSlot,
} from "@/lib/recentPickForm";
import {
  previewPickRewards,
  DEFAULT_SCORING_CONFIG,
  type ScoringConfig,
} from "@/lib/scoringConfig";
import { scoreMatchPrediction } from "@/lib/scoring";
import type { Match } from "@/lib/types";
import { isKnockoutStage } from "@/lib/types";
import { PlayerPodiumFlags } from "./PlayerPodiumFlags";
import { RecentPickFormDots } from "./RecentPickFormDots";

function formatPickScore(
  pick: CommunityMatchPick,
  match: Match
): string {
  const score = `${pick.predHomeScore}–${pick.predAwayScore}`;
  const isTie = pick.predHomeScore === pick.predAwayScore;
  const isKO = isKnockoutStage(match.stage);

  if (!isKO || !isTie || !pick.predWinnerTeamId) {
    return score;
  }

  const code =
    pick.predWinnerTeamId === match.home_team_id
      ? match.home_team?.fifa_code
      : pick.predWinnerTeamId === match.away_team_id
        ? match.away_team?.fifa_code
        : null;

  return code ? `${score} · ${code}` : score;
}

function maxPointsIfCorrect(
  match: Match,
  pick: CommunityMatchPick,
  scoringConfig: ScoringConfig
): number | null {
  if (match.status === "final") return null;

  const isKO = isKnockoutStage(match.stage);
  const isTie = pick.predHomeScore === pick.predAwayScore;
  if (isKO && isTie && !pick.predWinnerTeamId) return null;

  return previewPickRewards(
    match,
    pick.predHomeScore,
    pick.predAwayScore,
    scoringConfig,
    pick.predWinnerTeamId
  ).maxPoints;
}

function PicksParticipationLabel({
  predictedCount,
  totalPlayers,
  compact = false,
}: {
  predictedCount: number;
  totalPlayers: number;
  compact?: boolean;
}) {
  if (totalPlayers <= 0) return null;
  return (
    <span
      className={`font-semibold tabular-nums text-ink-faint normal-case tracking-normal ${
        compact ? "text-[10px]" : "text-xs"
      }`}
      title={`${predictedCount} of ${totalPlayers} players have locked a pick`}
    >
      {predictedCount}/{totalPlayers} picked
    </span>
  );
}

function CollapseChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`w-4 h-4 shrink-0 text-ink-faint transition-transform duration-200 ${
        expanded ? "rotate-180" : ""
      }`}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M4.5 6.25 8 9.75l3.5-3.5.708.708L8 11.167 3.792 6.958z"
      />
    </svg>
  );
}

function CommunityPicksHeader({
  embedded,
  expanded,
  onToggle,
  participation,
  pickCount,
}: {
  embedded: boolean;
  expanded: boolean;
  onToggle: () => void;
  participation: ReactNode;
  pickCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`w-full text-left px-4 py-3 border-b border-ink/5 hover:bg-ink/[0.03] transition-colors ${
        expanded ? "" : "border-b-0"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className={`font-bold uppercase tracking-wide shrink-0 ${
              embedded
                ? "text-xs text-ink-muted"
                : "text-sm text-usa"
            }`}
          >
            Everyone&apos;s picks
          </h3>
          {!expanded && pickCount > 0 && (
            <span className="text-[10px] font-semibold text-ink-faint normal-case tracking-normal truncate">
              {pickCount} {pickCount === 1 ? "pick" : "picks"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {participation}
          <CollapseChevron expanded={expanded} />
        </div>
      </div>
      {!embedded && (
        <p className="text-xs text-ink-muted mt-0.5">
          {expanded
            ? "What the group is predicting for this match"
            : "Tap to see what everyone picked"}
        </p>
      )}
    </button>
  );
}

export function MatchCommunityPicks({
  match,
  picks,
  currentPlayerId,
  embedded = false,
  scoringConfig = DEFAULT_SCORING_CONFIG,
  showLivePoints = false,
  totalPlayers,
  defaultExpanded = false,
}: {
  match: Match;
  picks: CommunityMatchPick[];
  currentPlayerId: string;
  embedded?: boolean;
  scoringConfig?: ScoringConfig;
  showLivePoints?: boolean;
  /** Registered players in the pool — for X/Y picked label. */
  totalPlayers?: number;
  /** Start with the pick list collapsed (header stays visible). */
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Identical predictions always sit next to each other: group rows by
  // predicted score (and KO winner pick), rank groups by their best points.
  const scoreKey = (pick: CommunityMatchPick) =>
    `${pick.predHomeScore}-${pick.predAwayScore}-${pick.predWinnerTeamId ?? ""}`;

  const groupPts = new Map<string, number>();
  for (const pick of picks) {
    const key = scoreKey(pick);
    const pts = maxPointsIfCorrect(match, pick, scoringConfig) ?? -1;
    groupPts.set(key, Math.max(groupPts.get(key) ?? -1, pts));
  }

  const totalGoals = (pick: CommunityMatchPick) =>
    pick.predHomeScore + pick.predAwayScore;

  const showingLiveScore = hasDisplayableLiveScore(match);

  const isPickExactRightNow = (pick: CommunityMatchPick) =>
    showingLiveScore &&
    match.home_score === pick.predHomeScore &&
    match.away_score === pick.predAwayScore;

  const sortedPicks = [...picks].sort((a, b) => {
    if (showingLiveScore) {
      const aExact = isPickExactRightNow(a);
      const bExact = isPickExactRightNow(b);
      if (aExact !== bExact) return aExact ? -1 : 1;

      const pickPrediction = (pick: CommunityMatchPick) => ({
        pred_home_score: pick.predHomeScore,
        pred_away_score: pick.predAwayScore,
        pred_winner_team_id: pick.predWinnerTeamId,
      });
      const aOut =
        isPickExactImpossible(match, a) ||
        isPickLiveEliminated(match, pickPrediction(a), scoringConfig);
      const bOut =
        isPickExactImpossible(match, b) ||
        isPickLiveEliminated(match, pickPrediction(b), scoringConfig);
      if (aOut !== bOut) return aOut ? 1 : -1;
    }

    const aKey = scoreKey(a);
    const bKey = scoreKey(b);
    const aPts = groupPts.get(aKey) ?? -1;
    const bPts = groupPts.get(bKey) ?? -1;
    if (bPts !== aPts) return bPts - aPts;
    if (totalGoals(b) !== totalGoals(a)) return totalGoals(b) - totalGoals(a);
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    return a.displayName.localeCompare(b.displayName);
  });

  const content = (
    <>
      {sortedPicks.length === 0 ? (
        <p className="text-center text-sm text-ink-faint py-6 px-4">
          No picks yet — be the first!
        </p>
      ) : (
        sortedPicks.map((pick) => {
          const isYou = pick.playerId === currentPlayerId;
          const maxPts = maxPointsIfCorrect(match, pick, scoringConfig);
          const pickPrediction = {
            pred_home_score: pick.predHomeScore,
            pred_away_score: pick.predAwayScore,
            pred_winner_team_id: pick.predWinnerTeamId,
          };
          const isLive = showingLiveScore;
          const liveEliminated =
            isLive && isPickLiveEliminated(match, pickPrediction, scoringConfig);
          const exactImpossible =
            isLive && isPickExactImpossible(match, pick);
          const exactRightNow = isPickExactRightNow(pick);
          const rowStateClass = exactRightNow
            ? "bg-mexico/10"
            : liveEliminated || exactImpossible
              ? "opacity-45 grayscale"
              : isYou
                ? "bg-usa/5"
                : "";
          const livePts =
            showLivePoints && showingLiveScore
              ? scoreMatchPrediction(
                  match,
                  {
                    pred_home_score: pick.predHomeScore,
                    pred_away_score: pick.predAwayScore,
                    pred_winner_team_id: pick.predWinnerTeamId,
                  },
                  scoringConfig,
                  { allowLive: true }
                ).points
              : null;
          return (
            <div
              key={pick.playerId}
              className={`lb-row lb-row--community transition-all duration-500 ${rowStateClass}`}
            >
              <PlayerPodiumFlags
                picks={pick.podiumPicks}
                fallbackEmoji={pick.avatarEmoji}
                size="xs"
                className="lb-row-flags"
              />
              <span className="lb-row-main font-semibold text-ink">
                <span className="lb-entry-name-text">{pick.displayName}</span>
                {isYou && (
                  <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-usa">
                    You
                  </span>
                )}
              </span>
              <RecentPickFormDots
                form={withLiveFormSlot(
                  pick.recentForm ?? [],
                  match,
                  pickPrediction,
                  scoringConfig
                )}
                className="lb-entry-form"
              />
              <span className="lb-row-pick">
                <span className="font-extrabold text-ink tabular-nums">
                  {formatPickScore(pick, match)}
                </span>
                {livePts != null ? (
                  <span className="block text-[10px] font-medium text-mexico tabular-nums mt-0.5">
                    +{livePts} live
                  </span>
                ) : (
                  maxPts != null && (
                    <span className="block text-[10px] font-medium text-ink-faint tabular-nums mt-0.5">
                      +{maxPts} max
                    </span>
                  )
                )}
              </span>
            </div>
          );
        })
      )}
    </>
  );

  const participation =
    totalPlayers != null ? (
      <PicksParticipationLabel
        predictedCount={picks.length}
        totalPlayers={totalPlayers}
        compact={embedded}
      />
    ) : null;

  if (embedded) {
    return (
      <div className="border-t border-ink/8 bg-cream/20">
        <CommunityPicksHeader
          embedded
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          participation={participation}
          pickCount={picks.length}
        />
        {expanded && content}
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <CommunityPicksHeader
        embedded={false}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        participation={participation}
        pickCount={picks.length}
      />
      {expanded && content}
    </div>
  );
}
