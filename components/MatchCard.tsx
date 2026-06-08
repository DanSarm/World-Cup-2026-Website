"use client";

import { useState, useTransition, useEffect, useRef, useCallback, useMemo } from "react";
import { ScoreControl, ScoreDisplay } from "./ScorePicker";
import { saveMatchPickAction } from "@/lib/actions";
import { formatKickoff, getLockStatus, canPickMatch } from "@/lib/utils";
import { getStageLabel, isKnockoutStage } from "@/lib/types";
import type { Match, MatchPrediction, Team } from "@/lib/types";
import { previewPickRewards, DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/lib/scoringConfig";
import { TeamFlag } from "./Flag";
import { TeamCode } from "./TeamCode";
import { MatchBonusPills } from "./MatchBonusPills";
import { MatchOddsBar } from "./MatchOddsBar";

interface MatchCardProps {
  match: Match;
  prediction?: MatchPrediction | null;
  scoringConfig?: ScoringConfig;
  onPickChange?: (matchId: string, home: number, away: number) => void;
}

export function MatchCard({
  match,
  prediction,
  scoringConfig = DEFAULT_SCORING_CONFIG,
  onPickChange,
}: MatchCardProps) {
  const [homeScore, setHomeScore] = useState(prediction?.pred_home_score ?? 0);
  const [awayScore, setAwayScore] = useState(prediction?.pred_away_score ?? 0);
  const [winnerId, setWinnerId] = useState<string | null>(
    prediction?.pred_winner_team_id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const skipAutoSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const lock = getLockStatus(match);
  const pickable = canPickMatch(match);
  const isKO = isKnockoutStage(match.stage);
  const needsWinner = isKO && homeScore === awayScore;

  const persistPick = useCallback(
    (home: number, away: number, winner: string | null) => {
      if (!pickable) return;
      if (isKO && home === away && !winner) return;

      const fd = new FormData();
      fd.set("matchId", match.id);
      fd.set("predHomeScore", String(home));
      fd.set("predAwayScore", String(away));
      if (winner) fd.set("predWinnerTeamId", winner);

      startTransition(async () => {
        const result = await saveMatchPickAction(fd);
        if (result.error) setError(result.error);
        else setError(null);
      });
    },
    [match.id, pickable, isKO]
  );

  useEffect(() => {
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    if (!pickable) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistPick(homeScore, awayScore, winnerId);
    }, 400);

    return () => clearTimeout(saveTimer.current);
  }, [homeScore, awayScore, winnerId, pickable, persistPick]);

  function notifyPickChange(home: number, away: number) {
    if (pickable && match.stage === "group" && onPickChange) {
      onPickChange(match.id, home, away);
    }
  }

  function handleHomeChange(score: number) {
    setHomeScore(score);
    notifyPickChange(score, awayScore);
  }

  function handleAwayChange(score: number) {
    setAwayScore(score);
    notifyPickChange(homeScore, score);
  }

  const displayHome = pickable ? homeScore : (prediction?.pred_home_score ?? 0);
  const displayAway = pickable ? awayScore : (prediction?.pred_away_score ?? 0);
  const showScores =
    match.home_team_id && match.away_team_id && (pickable || prediction);

  function handleWinnerPick(teamId: string) {
    setWinnerId(teamId);
  }

  const exactPointsPreview = useMemo(() => {
    if (!match.home_team_id || !match.away_team_id) return null;
    if (match.status === "final") return null;

    const predHome = pickable ? homeScore : prediction?.pred_home_score;
    const predAway = pickable ? awayScore : prediction?.pred_away_score;
    if (!pickable && (predHome == null || predAway == null)) return null;

    const predWinner = pickable
      ? winnerId
      : (prediction?.pred_winner_team_id ?? winnerId);

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
    homeScore,
    awayScore,
    winnerId,
    prediction,
    isKO,
    scoringConfig,
  ]);

  return (
    <article className="card space-y-4">
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
        {exactPointsPreview != null && (
          <div
            className="shrink-0 text-right leading-tight"
            title="Points if your exact score is correct"
          >
            <span className="text-base font-extrabold text-mexico tabular-nums">
              +{exactPointsPreview}
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              pts
            </span>
          </div>
        )}
      </div>

      <MatchupRow
        match={match}
        pickable={pickable}
        showScores={!!showScores}
        homeScore={homeScore}
        awayScore={awayScore}
        displayHome={displayHome}
        displayAway={displayAway}
        onHomeChange={handleHomeChange}
        onAwayChange={handleAwayChange}
      />

      <MatchOddsBar match={match} />

      <MatchBonusPills match={match} />

      {match.status === "final" && match.home_score !== null && (
        <div className="alert-info">
          <div className="text-lg font-extrabold">
            Final · {match.home_score} – {match.away_score}
          </div>
          {prediction && (
            <p className="text-sm opacity-80 mt-1">
              Your pick: {prediction.pred_home_score}–{prediction.pred_away_score}
              {prediction.points > 0 && (
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
                      onClick={() => handleWinnerPick(team.id)}
                      className={`flex-1 py-3 px-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
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
          {!prediction && (
            <p className="text-center text-sm text-canada font-semibold">
              🔒 Locked — no pick saved
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function MatchupRow({
  match,
  pickable,
  showScores,
  homeScore,
  awayScore,
  displayHome,
  displayAway,
  onHomeChange,
  onAwayChange,
}: {
  match: Match;
  pickable: boolean;
  showScores: boolean;
  homeScore: number;
  awayScore: number;
  displayHome: number;
  displayAway: number;
  onHomeChange: (v: number) => void;
  onAwayChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
      <TeamSide
        team={match.home_team}
        label={match.home_label}
        align="left"
      />

      <div className="flex items-center justify-center gap-2 shrink-0">
        {showScores && (
          <>
            {pickable ? (
              <ScoreControl value={homeScore} onChange={onHomeChange} compact />
            ) : (
              <ScoreDisplay value={displayHome} />
            )}
          </>
        )}
        <div className="shrink-0 w-9 h-9 rounded-full bg-cream flex items-center justify-center">
          <span className="text-[10px] font-black text-ink-faint">VS</span>
        </div>
        {showScores && (
          <>
            {pickable ? (
              <ScoreControl value={awayScore} onChange={onAwayChange} compact />
            ) : (
              <ScoreDisplay value={displayAway} />
            )}
          </>
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
      className={`flex flex-col gap-1 min-w-0 ${
        align === "right"
          ? "items-end justify-self-end text-right"
          : "items-start justify-self-start text-left"
      }`}
    >
      <TeamFlag team={team} size="lg" className="shrink-0" />
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
          <TeamCode code={team.fifa_code} prominent className="text-ink block" />
          <span className="text-xs font-medium text-ink-muted leading-snug truncate block mt-0.5">
            {team.short_name}
          </span>
        </>
      ) : (
        <span className="font-semibold text-sm text-ink-muted leading-snug">{label}</span>
      )}
    </div>
  );
}

