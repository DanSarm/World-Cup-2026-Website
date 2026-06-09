"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ScoreControl, ScoreDisplay } from "./ScorePicker";
import { saveMatchPickAction } from "@/lib/actions";
import { formatKickoff, getLockStatus, canPickMatch } from "@/lib/utils";
import { getStageLabel, isKnockoutStage } from "@/lib/types";
import type { Match, MatchPrediction, Team } from "@/lib/types";
import { previewPickRewards, DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/lib/scoringConfig";
import { scoreMatchPrediction } from "@/lib/scoring";
import { hasSavedPick, getEffectiveMatchPrediction, usesDefaultMissingPick } from "@/lib/pickUtils";
import { isMatchLive } from "@/lib/matchLive";
import { TeamFlag } from "./Flag";
import { TeamCode } from "./TeamCode";
import { MatchBonusPills } from "./MatchBonusPills";
import { hasAnyBonus } from "@/lib/matchBonuses";
import { MatchOddsBar } from "./MatchOddsBar";
import { PickCountdownBadge } from "./PickCountdown";
import { PickLockButton } from "./PickLockButton";
import { LivePill } from "./LivePill";

interface MatchCardProps {
  match: Match;
  prediction?: MatchPrediction | null;
  scoringConfig?: ScoringConfig;
  onPickChange?: (matchId: string, home: number, away: number) => void;
  showPickCountdown?: boolean;
  /** Render inside a parent card (no outer card shell). */
  embedded?: boolean;
}

export function MatchCard({
  match,
  prediction,
  scoringConfig = DEFAULT_SCORING_CONFIG,
  onPickChange,
  showPickCountdown = false,
  embedded = false,
}: MatchCardProps) {
  const router = useRouter();
  const saved = hasSavedPick(prediction);
  const isDefaultPick = usesDefaultMissingPick(match, prediction);
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
    if (winnerId) fd.set("predWinnerTeamId", winnerId);

    startTransition(async () => {
      const result = await saveMatchPickAction(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setIsLocked(true);
      router.refresh();
    });
  }, [homeScore, awayScore, winnerId, needsWinner, match.id, router]);

  function handleLockToggle() {
    if (isLocked) {
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

  const displayHome = pickable
    ? homeScore
    : (effectivePrediction?.pred_home_score ?? null);
  const displayAway = pickable
    ? awayScore
    : (effectivePrediction?.pred_away_score ?? null);
  const showScores =
    match.home_team_id &&
    match.away_team_id &&
    (pickable || effectivePrediction != null);

  function handleWinnerPick(teamId: string) {
    setWinnerId(teamId);
  }

  const exactPointsPreview = useMemo(() => {
    if (!match.home_team_id || !match.away_team_id) return null;
    if (match.status === "final") return null;

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

    return previewPickRewards(
      match,
      predHome,
      predAway,
      scoringConfig,
      predWinner
    ).maxPoints;
  }, [
    match,
    pickable,
    effectivePrediction,
    homeScore,
    awayScore,
    isKO,
    scoringConfig,
  ]);

  const livePointsPreview = useMemo(() => {
    if (!isLive || !effectivePrediction) return null;
    return scoreMatchPrediction(match, effectivePrediction, scoringConfig, {
      allowLive: true,
    }).points;
  }, [isLive, effectivePrediction, match, scoringConfig]);

  return (
    <article
      className={
        embedded ? "px-4 sm:px-5 py-4 space-y-4" : "card space-y-4"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-ink">
            {match.group_letter ? `Group ${match.group_letter}` : getStageLabel(match.stage)}
            <span className="text-ink-faint font-normal"> · {formatKickoff(match.kickoff_at)}</span>
          </p>
          {match.venue && (
            <p className="text-xs text-ink-faint truncate">{match.venue}</p>
          )}
        </div>
        <div className="flex items-start gap-2 shrink-0">
          {isLive && <LivePill />}
          {showPickCountdown && !isLive && (
            <PickCountdownBadge kickoffAt={match.kickoff_at} />
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
        liveHomeScore={isLive ? match.home_score : null}
        liveAwayScore={isLive ? match.away_score : null}
      />

      <MatchOddsBar match={match} />

      {(hasAnyBonus(match) || exactPointsPreview != null) && (
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
          <MatchBonusPills match={match} />
          {exactPointsPreview != null && (
            <PickPointsPreview
              points={exactPointsPreview}
              className="ml-auto shrink-0"
            />
          )}
        </div>
      )}

      {isLive && match.home_score !== null && match.away_score !== null && (
        <div className="rounded-xl border border-canada/25 bg-canada/5 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-canada">
              Live score
            </p>
            {match.live_updated_at && (
              <p className="text-[10px] text-ink-faint tabular-nums">
                Updated{" "}
                {new Date(match.live_updated_at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          {(saved || isDefaultPick) && effectivePrediction && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-ink-muted">
                Your pick:{" "}
                <span className="font-bold text-ink tabular-nums">
                  {effectivePrediction.pred_home_score}–{effectivePrediction.pred_away_score}
                </span>
                {isDefaultPick && (
                  <span className="text-ink-faint font-normal"> (default)</span>
                )}
              </p>
              {livePointsPreview != null && (
                <p className="font-semibold text-mexico tabular-nums">
                  {livePointsPreview > 0
                    ? `+${livePointsPreview} pts if it ended now`
                    : "0 pts if it ended now"}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {match.status === "final" && match.home_score !== null && (
        <div className="alert-info">
          <div className="text-lg font-extrabold">
            Final · {match.home_score} – {match.away_score}
          </div>
          {effectivePrediction && (
            <p className="text-sm opacity-80 mt-1">
              Your pick: {effectivePrediction.pred_home_score}–{effectivePrediction.pred_away_score}
              {isDefaultPick && (
                <span className="opacity-70"> (default 0-0)</span>
              )}
              {prediction && prediction.points > 0 && (
                <span className="font-bold text-mexico"> · +{prediction.points} pts 🎉</span>
              )}
            </p>
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
          {isDefaultPick && (
            <p className="text-center text-sm text-ink-muted">
              🔒 Locked — default pick 0–0
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function PickPointsPreview({
  points,
  className = "",
}: {
  points: number;
  className?: string;
}) {
  return (
    <div
      className={`text-right leading-tight ${className}`}
      title="Max points if your exact score is correct"
    >
      <span className="text-base font-extrabold text-mexico tabular-nums">
        +{points}
      </span>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        if exact
      </span>
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
}) {
  const showingLive =
    liveHomeScore != null && liveAwayScore != null && match.status === "live";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 md:gap-3">
      <TeamSide
        team={match.home_team}
        label={match.home_label}
        align="left"
      />

      <div className="flex items-center justify-center gap-1 md:gap-1.5 shrink-0">
        {showingLive ? (
          <>
            <LiveScoreDisplay value={liveHomeScore} />
            <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-canada/10 flex items-center justify-center">
              <span className="text-[9px] md:text-[10px] font-black text-canada">
                –
              </span>
            </div>
            <LiveScoreDisplay value={liveAwayScore} />
          </>
        ) : (
          showScores && (
            <>
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
            </>
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

function LiveScoreDisplay({ value }: { value: number }) {
  return (
    <span className="text-2xl md:text-3xl font-extrabold text-canada tabular-nums min-w-[2ch] text-center">
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
      className={`flex flex-col gap-1 min-w-0 max-w-[7.5rem] md:max-w-[9rem] ${
        align === "right"
          ? "items-end justify-self-end text-right"
          : "items-start justify-self-start text-left"
      }`}
    >
      <TeamFlag
        team={team}
        size="xl"
        highRes
        className="shrink-0 match-card-flag"
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

