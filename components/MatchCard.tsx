"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ScoreControl, ScoreDisplay } from "./ScorePicker";
import { saveMatchPickAction } from "@/lib/actions";
import { formatKickoff, getLockStatus, canPickMatch, isMatchFinished } from "@/lib/utils";
import { getStageLabel, isKnockoutStage } from "@/lib/types";
import type { Match, MatchPrediction, Team } from "@/lib/types";
import { previewPickRewards, DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/lib/scoringConfig";
import { scoreMatchPrediction, type ScoreMatchResult } from "@/lib/scoring";
import { hasSavedPick, getEffectiveMatchPrediction } from "@/lib/pickUtils";
import {
  isMatchDecidedForScoring,
  isMatchLive,
  hasDisplayableLiveScore,
} from "@/lib/matchLive";
import { TeamFlag } from "./Flag";
import { TeamCode } from "./TeamCode";
import { MatchBonusPills } from "./MatchBonusPills";
import { hasAnyBonus, outcomePreviewLabel } from "@/lib/matchBonuses";
import { MatchOddsBar } from "./MatchOddsBar";
import { PickCountdownBadge } from "./PickCountdown";
import { PickLockButton } from "./PickLockButton";
import { playPickLockSound, playPickUnlockSound } from "@/lib/pickLockSound";
import { LivePill } from "./LivePill";
import { LiveMatchClock } from "./LiveMatchClock";

interface MatchCardProps {
  match: Match;
  prediction?: MatchPrediction | null;
  scoringConfig?: ScoringConfig;
  onPickChange?: (matchId: string, home: number, away: number) => void;
  showPickCountdown?: boolean;
  /** Render inside a parent card (no outer card shell). */
  embedded?: boolean;
  /** Community consensus, e.g. { score: "2–1", percent: 45 } */
  mostPickedScore?: { score: string; percent: number } | null;
  onPickSaved?: () => void;
}

function matchPointsPillClass(result: ScoreMatchResult | null): string {
  if (!result || result.points === 0) return "match-pts-pill--zero";
  if (result.exactScore) return "match-pts-pill--exact";
  if (result.correctResult || result.knockoutCorrect) return "match-pts-pill--correct";
  return "match-pts-pill--zero";
}

function livePointsPillClass(result: ScoreMatchResult | null): string {
  if (!result || result.points === 0) return "match-pts-pill--grey";
  if (result.exactScore) return "match-pts-pill--exact";
  if (result.correctResult || result.knockoutCorrect) return "match-pts-pill--correct";
  return "match-pts-pill--grey";
}

export function MatchCard({
  match,
  prediction,
  scoringConfig = DEFAULT_SCORING_CONFIG,
  onPickChange,
  showPickCountdown = false,
  embedded = false,
  mostPickedScore = null,
  onPickSaved,
}: MatchCardProps) {
  const router = useRouter();
  const saved = hasSavedPick(prediction);
  const effectivePrediction = getEffectiveMatchPrediction(match, prediction);
  const [homeScore, setHomeScore] = useState<number | null>(
    saved ? (prediction?.pred_home_score ?? null) : null
  );
  const [awayScore, setAwayScore] = useState<number | null>(
    saved ? (prediction?.pred_away_score ?? null) : null
  );
  const [winnerId, setWinnerId] = useState<string | null>(
    prediction?.pred_winner_team_id ?? null
  );
  const [isLocked, setIsLocked] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const lock = getLockStatus(match);
  const pickable = canPickMatch(match);
  const isLive = isMatchLive(match);
  const showingLiveScore = hasDisplayableLiveScore(match);
  const isKO = isKnockoutStage(match.stage);
  const needsWinner =
    isKO && homeScore !== null && awayScore !== null && homeScore === awayScore;
  const canLock =
    homeScore !== null &&
    awayScore !== null &&
    (!needsWinner || winnerId !== null);

  const savePick = useCallback(() => {
    if (homeScore === null || awayScore === null) {
      setError("Set both scores before locking");
      return;
    }
    if (needsWinner && !winnerId) {
      setError("Pick who advances before locking");
      return;
    }

    const fd = new FormData();
    fd.set("matchId", match.id);
    fd.set("predHomeScore", String(homeScore));
    fd.set("predAwayScore", String(awayScore));
    if (match.home_team_id) fd.set("homeTeamId", match.home_team_id);
    if (match.away_team_id) fd.set("awayTeamId", match.away_team_id);
    if (winnerId) fd.set("predWinnerTeamId", winnerId);

    startTransition(async () => {
      const result = await saveMatchPickAction(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setIsLocked(true);
      playPickLockSound();
      router.refresh();
      onPickSaved?.();
    });
  }, [
    homeScore,
    awayScore,
    winnerId,
    needsWinner,
    match.id,
    match.home_team_id,
    match.away_team_id,
    router,
    onPickSaved,
  ]);

  function handleLockToggle() {
    if (isLocked) {
      playPickUnlockSound();
      setIsLocked(false);
      setError(null);
      return;
    }
    savePick();
  }

  function notifyPickChange(home: number, away: number) {
    if (pickable && match.stage === "group" && onPickChange) {
      onPickChange(match.id, home, away);
    }
  }

  function handleHomeChange(score: number | null) {
    setHomeScore(score);
    if (score !== null && awayScore !== null) {
      notifyPickChange(score, awayScore);
    }
  }

  function handleAwayChange(score: number | null) {
    setAwayScore(score);
    if (homeScore !== null && score !== null) {
      notifyPickChange(homeScore, score);
    }
  }

  const finished = isMatchFinished(match);
  const showFinalScore =
    finished && match.home_score !== null && match.away_score !== null;

  const displayHome = showFinalScore
    ? match.home_score
    : pickable
      ? homeScore
      : (effectivePrediction?.pred_home_score ?? null);
  const displayAway = showFinalScore
    ? match.away_score
    : pickable
      ? awayScore
      : (effectivePrediction?.pred_away_score ?? null);
  const showScores =
    match.home_team_id &&
    match.away_team_id &&
    (pickable || effectivePrediction != null || showFinalScore);

  function handleWinnerPick(teamId: string) {
    setWinnerId(teamId);
  }

  const pickRewardsPreview = useMemo(() => {
    if (!match.home_team_id || !match.away_team_id) return null;
    if (isMatchDecidedForScoring(match)) return null;

    let predHome: number;
    let predAway: number;

    if (pickable) {
      if (homeScore === null || awayScore === null) return null;
      predHome = homeScore;
      predAway = awayScore;
    } else {
      if (!effectivePrediction) return null;
      predHome = effectivePrediction.pred_home_score;
      predAway = effectivePrediction.pred_away_score;
    }

    const predWinner = pickable
      ? winnerId
      : (effectivePrediction?.pred_winner_team_id ?? winnerId);

    if (isKO && predHome === predAway && !predWinner) return null;

    const rewards = previewPickRewards(
      match,
      predHome,
      predAway,
      scoringConfig,
      predWinner
    );

    return {
      exactPoints: rewards.maxPoints,
      outcomePoints: rewards.resultOnlyPoints,
      outcomeLabel: outcomePreviewLabel(
        match,
        predHome,
        predAway,
        predWinner
      ),
    };
  }, [
    match,
    pickable,
    effectivePrediction,
    homeScore,
    awayScore,
    winnerId,
    isKO,
    scoringConfig,
  ]);

  const livePointsPreview = useMemo(() => {
    if (!isLive || !effectivePrediction) return null;
    return scoreMatchPrediction(match, effectivePrediction, scoringConfig, {
      allowLive: true,
    });
  }, [isLive, effectivePrediction, match, scoringConfig]);

  const finalScoreResult = useMemo(() => {
    if (!isMatchDecidedForScoring(match) || !effectivePrediction) return null;
    if (match.home_score === null || match.away_score === null) return null;
    return scoreMatchPrediction(match, effectivePrediction, scoringConfig);
  }, [match, effectivePrediction, scoringConfig]);

  const decidedForScoring = isMatchDecidedForScoring(match);
  const pickDisplayHome =
    saved && effectivePrediction && (showingLiveScore || decidedForScoring)
      ? effectivePrediction.pred_home_score
      : null;
  const pickDisplayAway =
    saved && effectivePrediction && (showingLiveScore || decidedForScoring)
      ? effectivePrediction.pred_away_score
      : null;

  return (
    <article
      className={
        embedded ? "px-4 sm:px-5 py-4 space-y-4" : "card space-y-4"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-ink">
            {match.group_letter
              ? `Group ${match.group_letter}`
              : embedded && isKO
                ? formatKickoff(match.kickoff_at)
                : getStageLabel(match.stage)}
            {!match.group_letter && !(embedded && isKO) && (
              <span className="text-ink-faint font-normal">
                {" "}
                · {formatKickoff(match.kickoff_at)}
              </span>
            )}
            {match.group_letter && (
              <span className="text-ink-faint font-normal">
                {" "}
                · {formatKickoff(match.kickoff_at)}
              </span>
            )}
          </p>
          {match.venue && (
            <p className="text-xs text-ink-faint truncate">{match.venue}</p>
          )}
        </div>
        <div className="flex items-start gap-2 shrink-0">
          {decidedForScoring &&
            !showingLiveScore &&
            match.home_score !== null && (
              <span
                className={`match-pts-pill tabular-nums ${matchPointsPillClass(finalScoreResult)}`}
              >
                {finalScoreResult?.points ?? 0} pts
              </span>
            )}
          {showingLiveScore && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <LivePill />
                {saved &&
                  effectivePrediction &&
                  livePointsPreview != null && (
                    <span
                      className={`match-pts-pill tabular-nums ${livePointsPillClass(livePointsPreview)}`}
                    >
                      {livePointsPreview.points} pts
                    </span>
                  )}
              </div>
              <LiveMatchClock clock={match.live_clock_display} />
            </div>
          )}
          {showPickCountdown && !showingLiveScore && !isLive && (
            <PickCountdownBadge
              kickoffAt={match.kickoff_at}
              finished={isMatchFinished(match)}
            />
          )}
          {pickable && (
            <PickLockButton
              isLocked={isLocked}
              isSaving={isSaving}
              onClick={handleLockToggle}
              canLock={canLock}
            />
          )}
        </div>
      </div>

      <MatchupRow
        match={match}
        pickable={pickable}
        scoresLocked={pickable && isLocked}
        showScores={!!showScores}
        homeScore={homeScore}
        awayScore={awayScore}
        displayHome={displayHome}
        displayAway={displayAway}
        onHomeChange={handleHomeChange}
        onAwayChange={handleAwayChange}
        liveHomeScore={showingLiveScore ? match.home_score : null}
        liveAwayScore={showingLiveScore ? match.away_score : null}
        pickHomeScore={pickDisplayHome}
        pickAwayScore={pickDisplayAway}
        finalHomeScore={showFinalScore ? match.home_score : null}
        finalAwayScore={showFinalScore ? match.away_score : null}
      />

      <MatchOddsBar match={match} />

      {!decidedForScoring &&
        (hasAnyBonus(match) || pickRewardsPreview != null || mostPickedScore) && (
        <div className="flex items-end flex-wrap gap-x-3 gap-y-2">
          {mostPickedScore && (
            <div
              className="leading-tight shrink-0"
              title="The score most players picked for this match"
            >
              <span className="text-base font-extrabold text-usa tabular-nums">
                {mostPickedScore.score}
                <span className="text-xs font-bold text-ink-muted">
                  {" "}
                  · {mostPickedScore.percent}%
                </span>
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                Most-picked score
              </span>
            </div>
          )}
          <MatchBonusPills match={match} />
          {pickRewardsPreview != null && (
            <PickRewardsPreview
              outcomePoints={pickRewardsPreview.outcomePoints}
              outcomeLabel={pickRewardsPreview.outcomeLabel}
              exactPoints={pickRewardsPreview.exactPoints}
              className="ml-auto shrink-0"
            />
          )}
        </div>
      )}

      {!match.home_team_id || !match.away_team_id ? (
        <p className="alert-pending">
          Teams TBA — picks open when teams are set
        </p>
      ) : pickable ? (
        <>
          {needsWinner && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-center text-ink-muted">
                Who advances?
              </p>
              <div className="flex gap-2">
                {[match.home_team, match.away_team].map((team) =>
                  team ? (
                    <button
                      key={team.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleWinnerPick(team.id)}
                      className={`flex-1 py-3 px-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed ${
                        winnerId === team.id
                          ? "border-usa bg-usa/5 text-usa"
                          : "border-ink/10 hover:border-usa/40 text-ink-muted"
                      }`}
                    >
                      <TeamFlag team={team} size="sm" />
                      <TeamCode code={team.fifa_code} className="text-usa" />
                    </button>
                  ) : null
                )}
              </div>
            </div>
          )}

          {error && <div className="alert-error">{error}</div>}
        </>
      ) : lock.variant !== "final" ? (
        <div className="space-y-3">
          {error && <div className="alert-error">{error}</div>}
          {!saved && !pickable && (
            <p className="text-center text-sm text-ink-muted">
              🔒 Locked — no pick submitted
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function PickRewardsPreview({
  outcomePoints,
  outcomeLabel,
  exactPoints,
  className = "",
}: {
  outcomePoints: number;
  outcomeLabel: string;
  exactPoints: number;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <div
        className="text-right leading-tight"
        title={`${outcomePoints} pts if the result matches your pick but the score is wrong`}
      >
        <span className="text-base font-extrabold text-usa tabular-nums">
          +{outcomePoints}
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint max-w-[6.5rem] truncate">
          {outcomeLabel}
        </span>
      </div>
      <div
        className="text-right leading-tight"
        title={`${exactPoints} pts if your exact score is correct`}
      >
        <span className="text-base font-extrabold text-mexico tabular-nums">
          +{exactPoints}
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          if exact
        </span>
      </div>
    </div>
  );
}

function MatchupRow({
  match,
  pickable,
  scoresLocked,
  showScores,
  homeScore,
  awayScore,
  displayHome,
  displayAway,
  onHomeChange,
  onAwayChange,
  liveHomeScore,
  liveAwayScore,
  pickHomeScore,
  pickAwayScore,
  finalHomeScore,
  finalAwayScore,
}: {
  match: Match;
  pickable: boolean;
  scoresLocked: boolean;
  showScores: boolean;
  homeScore: number | null;
  awayScore: number | null;
  displayHome: number | null;
  displayAway: number | null;
  onHomeChange: (v: number | null) => void;
  onAwayChange: (v: number | null) => void;
  liveHomeScore?: number | null;
  liveAwayScore?: number | null;
  pickHomeScore?: number | null;
  pickAwayScore?: number | null;
  finalHomeScore?: number | null;
  finalAwayScore?: number | null;
}) {
  const showingLive =
    liveHomeScore != null && liveAwayScore != null;
  const showingPickAboveScore =
    pickHomeScore != null && pickAwayScore != null;
  const showingFinal =
    !showingLive &&
    finalHomeScore != null &&
    finalAwayScore != null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 md:gap-3">
      <TeamSide
        team={match.home_team}
        label={match.home_label}
        align="left"
      />

      <div className="flex flex-col items-center justify-center gap-0.5 shrink-0">
        {showingLive ? (
          <>
            {showingPickAboveScore && (
              <div className="flex items-center gap-1 md:gap-1.5">
                <PickScoreDisplay value={pickHomeScore} />
                <div className="shrink-0 w-7 h-5 md:w-8 flex items-center justify-center">
                  <span className="text-[8px] md:text-[9px] font-bold text-ink-faint">
                    –
                  </span>
                </div>
                <PickScoreDisplay value={pickAwayScore} />
              </div>
            )}
            <div className="flex items-center gap-1 md:gap-1.5">
              <LiveScoreDisplay value={liveHomeScore} />
              <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-canada/10 flex items-center justify-center">
                <span className="text-[9px] md:text-[10px] font-black text-canada">
                  –
                </span>
              </div>
              <LiveScoreDisplay value={liveAwayScore} />
            </div>
          </>
        ) : showingFinal ? (
          <>
            {showingPickAboveScore && (
              <div className="flex items-center gap-1 md:gap-1.5">
                <PickScoreDisplay value={pickHomeScore} />
                <div className="shrink-0 w-7 h-5 md:w-8 flex items-center justify-center">
                  <span className="text-[8px] md:text-[9px] font-bold text-ink-faint">
                    –
                  </span>
                </div>
                <PickScoreDisplay value={pickAwayScore} />
              </div>
            )}
            <div className="flex items-center gap-1 md:gap-1.5">
              <FinalScoreDisplay value={finalHomeScore} />
              <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-ink/5 flex items-center justify-center">
                <span className="text-[9px] md:text-[10px] font-black text-ink-faint">
                  –
                </span>
              </div>
              <FinalScoreDisplay value={finalAwayScore} />
            </div>
          </>
        ) : (
          showScores && (
            <div className="flex items-center gap-1 md:gap-1.5">
              {pickable ? (
                <ScoreControl
                  value={homeScore}
                  onChange={onHomeChange}
                  compact
                  disabled={scoresLocked}
                />
              ) : (
                <ScoreDisplay value={displayHome} compact />
              )}
              <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-cream flex items-center justify-center">
                <span className="text-[9px] md:text-[10px] font-black text-ink-faint">
                  VS
                </span>
              </div>
              {pickable ? (
                <ScoreControl
                  value={awayScore}
                  onChange={onAwayChange}
                  compact
                  disabled={scoresLocked}
                />
              ) : (
                <ScoreDisplay value={displayAway} compact />
              )}
            </div>
          )
        )}
      </div>

      <TeamSide
        team={match.away_team}
        label={match.away_label}
        align="right"
      />
    </div>
  );
}

function PickScoreDisplay({ value }: { value: number }) {
  return (
    <span className="match-pick-score-display">{value}</span>
  );
}

function LiveScoreDisplay({ value }: { value: number }) {
  return (
    <span className="text-2xl md:text-3xl font-extrabold text-canada tabular-nums min-w-[2ch] text-center">
      {value}
    </span>
  );
}

function FinalScoreDisplay({ value }: { value: number }) {
  return (
    <span className="text-2xl md:text-3xl font-extrabold text-ink tabular-nums min-w-[2ch] text-center">
      {value}
    </span>
  );
}

function TeamSide({
  team,
  label,
  align,
}: {
  team?: Team | null;
  label: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-col gap-1 min-w-0 max-w-[5.75rem] sm:max-w-[7.5rem] md:max-w-[9rem] ${
        align === "right"
          ? "items-end justify-self-end text-right"
          : "items-start justify-self-start text-left"
      }`}
    >
      <TeamFlag
        team={team}
        size="xl"
        highRes
        className="shrink-0 match-card-flag w-14 h-[42px] sm:w-20 sm:h-[60px]"
      />
      <TeamMeta team={team} label={label} align={align} />
    </div>
  );
}

function TeamMeta({
  team,
  label,
  align,
}: {
  team?: Team | null;
  label: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`min-w-0 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {team ? (
        <>
          <TeamCode
            code={team.fifa_code}
            className="!text-base md:!text-lg tracking-wide text-ink block leading-none"
          />
          <span className="text-[11px] md:text-xs font-medium text-ink-muted leading-tight truncate block mt-0.5 max-w-full">
            {team.short_name}
          </span>
        </>
      ) : (
        <span className="font-semibold text-sm text-ink-muted leading-snug">{label}</span>
      )}
    </div>
  );
}

