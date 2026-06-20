"use client";

import { useState, Fragment, type ReactNode } from "react";
import { hasDisplayableLiveScore, isMatchDecidedForScoring } from "@/lib/matchLive";
import type { CommunityMatchPick } from "@/lib/types";
import {
  isPickLiveEliminated,
} from "@/lib/recentPickForm";
import {
  previewPickRewards,
  DEFAULT_SCORING_CONFIG,
  type ScoringConfig,
} from "@/lib/scoringConfig";
import { scoreMatchPrediction, type ScoreMatchResult } from "@/lib/scoring";
import type { Match } from "@/lib/types";
import { isKnockoutStage } from "@/lib/types";
import { canRevealOtherPlayersPicks } from "@/lib/pickVisibility";
import { TeamFlag } from "./Flag";

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

function PredictedWinnerIndicator({
  pick,
  match,
}: {
  pick: CommunityMatchPick;
  match: Match;
}) {
  if (pick.predHomeScore === pick.predAwayScore) {
    return (
      <span
        className="lb-row-flags inline-flex w-5 shrink-0 items-center justify-center font-team-code text-[9px] font-bold uppercase tracking-wide text-ink-muted"
        title="Predicted draw"
      >
        TIE
      </span>
    );
  }

  const team =
    pick.predHomeScore > pick.predAwayScore
      ? match.home_team
      : match.away_team;

  return (
    <TeamFlag team={team} size="xs" className="lb-row-flags" />
  );
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

function pickPtsClass(result: ScoreMatchResult): string {
  if (result.exactScore) return "text-gold-dark";
  if (result.correctResult || result.knockoutCorrect) return "text-mexico";
  if (result.points === 0) return "text-canada";
  return "text-ink-faint";
}

type PickOutcome = "home" | "draw" | "away";

function getPickOutcome(pick: CommunityMatchPick): PickOutcome {
  if (pick.predHomeScore > pick.predAwayScore) return "home";
  if (pick.predAwayScore > pick.predHomeScore) return "away";
  return "draw";
}

function getOutcomeSectionOrder(match: Match): PickOutcome[] {
  const homeProb = match.home_implied_probability ?? 0;
  const awayProb = match.away_implied_probability ?? 0;
  const favoriteFirst: PickOutcome = homeProb >= awayProb ? "home" : "away";
  const underdog: PickOutcome = favoriteFirst === "home" ? "away" : "home";
  return [favoriteFirst, "draw", underdog];
}

function CommunityPickOutcomeDivider({
  outcome,
  match,
}: {
  outcome: PickOutcome;
  match: Match;
}) {
  if (outcome === "draw") {
    return (
      <div
        className="community-picks-outcome-divider flex items-center gap-1.5 px-4 py-1 border-t border-ink/[0.06] bg-ink/[0.015]"
        aria-hidden
      >
        <span className="font-team-code text-[9px] font-bold uppercase tracking-wide text-ink-faint/70">
          TIE
        </span>
      </div>
    );
  }

  const team =
    outcome === "home" ? match.home_team : match.away_team;

  return (
    <div
      className="community-picks-outcome-divider flex items-center gap-1.5 px-4 py-1 border-t border-ink/[0.06] bg-ink/[0.015]"
      aria-hidden
    >
      <TeamFlag team={team} size="xs" className="opacity-45" />
      {team?.fifa_code && (
        <span className="font-team-code text-[9px] font-semibold uppercase tracking-wide text-ink-faint/70">
          {team.fifa_code}
        </span>
      )}
    </div>
  );
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
  picksRevealed,
}: {
  embedded: boolean;
  expanded: boolean;
  onToggle: () => void;
  participation: ReactNode;
  pickCount: number;
  picksRevealed: boolean;
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
            ? picksRevealed
              ? "What the group is predicting for this match"
              : "Your pick only — everyone else's stay hidden until kickoff"
            : picksRevealed
              ? "Tap to see what everyone picked"
              : "Tap to see your pick · others hidden until kickoff"}
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
  predictedCount,
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
  /** Total confirmed picks (may exceed visible picks before kickoff). */
  predictedCount?: number;
  /** Start with the pick list collapsed (header stays visible). */
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const picksRevealed = canRevealOtherPlayersPicks(match);
  const participationCount = predictedCount ?? picks.length;
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
  const matchDecided = isMatchDecidedForScoring(match);
  const showEarnedPoints =
    showLivePoints && (showingLiveScore || matchDecided);

  const isPickExactRightNow = (pick: CommunityMatchPick) =>
    match.home_score != null &&
    match.away_score != null &&
    match.home_score === pick.predHomeScore &&
    match.away_score === pick.predAwayScore;

  const earnedPointsForPick = (pick: CommunityMatchPick) =>
    scoreMatchPrediction(
      match,
      {
        pred_home_score: pick.predHomeScore,
        pred_away_score: pick.predAwayScore,
        pred_winner_team_id: pick.predWinnerTeamId,
      },
      scoringConfig,
      showingLiveScore ? { allowLive: true } : undefined
    );

  const comparePicks = (a: CommunityMatchPick, b: CommunityMatchPick) => {
    if (showEarnedPoints && match.home_score != null) {
      if (showingLiveScore) {
        const aExact = isPickExactRightNow(a);
        const bExact = isPickExactRightNow(b);
        if (aExact !== bExact) return aExact ? -1 : 1;

        const pickPrediction = (pick: CommunityMatchPick) => ({
          pred_home_score: pick.predHomeScore,
          pred_away_score: pick.predAwayScore,
          pred_winner_team_id: pick.predWinnerTeamId,
        });
        const aPts = earnedPointsForPick(a).points;
        const bPts = earnedPointsForPick(b).points;
        if (bPts !== aPts) return bPts - aPts;
        const aOut = isPickLiveEliminated(
          match,
          pickPrediction(a),
          scoringConfig
        );
        const bOut = isPickLiveEliminated(
          match,
          pickPrediction(b),
          scoringConfig
        );
        if (aOut !== bOut) return aOut ? 1 : -1;
      } else {
        const aPts = earnedPointsForPick(a).points;
        const bPts = earnedPointsForPick(b).points;
        if (bPts !== aPts) return bPts - aPts;
        const aExact = isPickExactRightNow(a);
        const bExact = isPickExactRightNow(b);
        if (aExact !== bExact) return aExact ? -1 : 1;
      }
    }

    const aKey = scoreKey(a);
    const bKey = scoreKey(b);
    const aPts = groupPts.get(aKey) ?? -1;
    const bPts = groupPts.get(bKey) ?? -1;
    if (bPts !== aPts) return bPts - aPts;
    if (totalGoals(b) !== totalGoals(a)) return totalGoals(b) - totalGoals(a);
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    return a.displayName.localeCompare(b.displayName);
  };

  const picksByOutcome = new Map<PickOutcome, CommunityMatchPick[]>();
  for (const outcome of getOutcomeSectionOrder(match)) {
    picksByOutcome.set(outcome, []);
  }
  for (const pick of picks) {
    const outcome = getPickOutcome(pick);
    picksByOutcome.get(outcome)?.push(pick);
  }
  for (const outcome of picksByOutcome.keys()) {
    picksByOutcome.get(outcome)?.sort(comparePicks);
  }

  const outcomeSections = getOutcomeSectionOrder(match)
    .map((outcome) => ({
      outcome,
      picks: picksByOutcome.get(outcome) ?? [],
    }))
    .filter((section) => section.picks.length > 0);

  const totalVisiblePicks = outcomeSections.reduce(
    (sum, section) => sum + section.picks.length,
    0
  );

  const renderPickRow = (pick: CommunityMatchPick) => {
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
    const exactRightNow = isPickExactRightNow(pick);
    const rowStateClass = exactRightNow
      ? "bg-mexico/10"
      : liveEliminated
        ? "opacity-45 grayscale"
        : isYou
          ? "bg-usa/5"
          : "";
    const liveScoreResult = showEarnedPoints
      ? earnedPointsForPick(pick)
      : null;
    const earnedPts = liveScoreResult?.points ?? null;

    return (
      <div
        key={pick.playerId}
        className={`lb-row lb-row--community transition-all duration-500 ${rowStateClass}`}
      >
        <PredictedWinnerIndicator pick={pick} match={match} />
        <span className="lb-row-main font-semibold text-ink">
          <span className="lb-entry-name-text">{pick.displayName}</span>
          {isYou && (
            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-usa">
              You
            </span>
          )}
        </span>
        <span className="lb-row-pick inline-flex items-center justify-end gap-2">
          <span className="font-extrabold text-ink tabular-nums">
            {formatPickScore(pick, match)}
          </span>
          {earnedPts != null && liveScoreResult ? (
            <span
              className={`text-[10px] font-medium tabular-nums shrink-0 ${pickPtsClass(liveScoreResult)}`}
            >
              {earnedPts} pts
            </span>
          ) : (
            maxPts != null && (
              <span className="text-[10px] font-medium text-ink-faint tabular-nums shrink-0">
                {maxPts} max
              </span>
            )
          )}
        </span>
      </div>
    );
  };

  const content = (
    <>
      {!picksRevealed && totalVisiblePicks === 0 ? (
        <p className="text-center text-sm text-ink-faint py-6 px-4">
          Other picks stay hidden until kickoff.
          {participationCount > 0 && (
            <>
              {" "}
              {participationCount} player{participationCount === 1 ? "" : "s"}{" "}
              {participationCount === 1 ? "has" : "have"} already locked in.
            </>
          )}
        </p>
      ) : totalVisiblePicks === 0 ? (
        <p className="text-center text-sm text-ink-faint py-6 px-4">
          No picks yet — be the first!
        </p>
      ) : (
        <>
          {!picksRevealed && (
            <p className="text-xs text-ink-muted px-4 py-2 border-b border-ink/5 bg-cream/30">
              Only your pick is shown until kickoff.
            </p>
          )}
          {outcomeSections.map((section, sectionIndex) => (
            <Fragment key={section.outcome}>
              {sectionIndex > 0 && (
                <CommunityPickOutcomeDivider
                  outcome={section.outcome}
                  match={match}
                />
              )}
              {section.picks.map(renderPickRow)}
            </Fragment>
          ))}
        </>
      )}
    </>
  );

  const participation =
    totalPlayers != null ? (
      <PicksParticipationLabel
        predictedCount={participationCount}
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
          pickCount={participationCount}
          picksRevealed={picksRevealed}
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
        pickCount={participationCount}
        picksRevealed={picksRevealed}
      />
      {expanded && content}
    </div>
  );
}
