"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlayerProfileData, PlayerPickSummary } from "@/lib/playerProfile";
import { PlayerPodiumFlags } from "./PlayerPodiumFlags";
import { RecentPickFormDots } from "./RecentPickFormDots";
import { RankMedal } from "./PlaceMedal";
import { Flag } from "./Flag";
import { formatMoney } from "@/lib/payouts";
import { ProfilePodiumShowcase } from "./ProfilePodiumShowcase";
import { LeaderboardProgressionChart } from "./LeaderboardProgressionChart";

type PickFilter = "all" | "exact" | "correct" | "miss";

interface PlayerProfileClientProps {
  profile: PlayerProfileData;
  isOwnProfile?: boolean;
}

function formatPickScore(pick: PlayerPickSummary): string {
  const score = `${pick.predHome}–${pick.predAway}`;
  if (pick.predWinnerCode) return `${score} · ${pick.predWinnerCode}`;
  return score;
}

function formatActualScore(pick: PlayerPickSummary): string | null {
  if (pick.actualHome == null || pick.actualAway == null) return null;
  const score = `${pick.actualHome}–${pick.actualAway}`;
  if (pick.decidedByPenalties && pick.actualWinnerCode) {
    return `${score} · ${pick.actualWinnerCode} won on pens`;
  }
  return score;
}

function pickStageTag(pick: PlayerPickSummary): string {
  if (pick.groupLetter) return `Group ${pick.groupLetter}`;
  return pick.stageLabel;
}

function pickOutcomePill(pick: PlayerPickSummary): {
  label: string;
  className: string;
} {
  if (pick.status === "upcoming") {
    return { label: "Upcoming", className: "profile-pick-pill profile-pick-pill--upcoming" };
  }
  if (pick.status === "live") {
    return { label: "Live", className: "profile-pick-pill profile-pick-pill--live" };
  }
  if (pick.exactScore) {
    return { label: "Exact", className: "profile-pick-pill profile-pick-pill--exact" };
  }
  if (pick.scorelineMatch && !pick.correctResult) {
    return { label: "Miss", className: "profile-pick-pill profile-pick-pill--miss" };
  }
  if (pick.correctResult) {
    return { label: "Correct", className: "profile-pick-pill profile-pick-pill--correct" };
  }
  return { label: "Miss", className: "profile-pick-pill profile-pick-pill--miss" };
}

function PickCard({ pick }: { pick: PlayerPickSummary }) {
  const actual = formatActualScore(pick);
  const displayPoints =
    pick.status === "live" && pick.livePoints != null
      ? pick.livePoints
      : pick.points;
  const outcome = pickOutcomePill(pick);
  const showPoints = pick.status === "scored" || pick.status === "live";

  return (
    <article className="card profile-pick-card">
      <div className="profile-pick-card-top">
        <div className="profile-pick-pills">
          <span className="profile-pick-pill profile-pick-pill--stage">
            {pickStageTag(pick)}
          </span>
          <span className={outcome.className}>{outcome.label}</span>
        </div>
        {showPoints && (
          <p className="profile-pick-points">
            +{displayPoints}
            <span className="profile-pick-points-unit">pts</span>
          </p>
        )}
      </div>

      <div className="profile-pick-matchup">
        <div className="profile-pick-team">
          <Flag fifaCode={pick.homeCode} size="sm" title={pick.homeLabel} />
          <span className="profile-pick-team-name">{pick.homeLabel}</span>
        </div>
        <span className="profile-pick-vs">vs</span>
        <div className="profile-pick-team profile-pick-team--away">
          <Flag fifaCode={pick.awayCode} size="sm" title={pick.awayLabel} />
          <span className="profile-pick-team-name">{pick.awayLabel}</span>
        </div>
      </div>

      <div className="profile-pick-scores">
        <div className="profile-pick-score-box">
          <span className="profile-pick-score-label">Picked</span>
          <span className="profile-pick-score-value">{formatPickScore(pick)}</span>
        </div>
        <div className="profile-pick-score-box">
          <span className="profile-pick-score-label">
            {pick.status === "upcoming" ? "Kickoff" : "Final"}
          </span>
          <span className="profile-pick-score-value">
            {actual ?? (pick.status === "upcoming" ? "—" : "Pending")}
          </span>
        </div>
      </div>

      {pick.outcomeNote && (
        <p className="profile-pick-outcome-note text-xs text-canada mt-2">
          {pick.outcomeNote}
        </p>
      )}

      {pick.breakdownLines.length > 0 && (
        <details className="profile-pick-breakdown group">
          <summary className="profile-pick-breakdown-toggle">
            <span className="group-open:rotate-90 transition-transform">▸</span>
            Points breakdown
          </summary>
          <div className="profile-pick-breakdown-body">
            <ul className="space-y-0.5 text-xs text-ink-muted">
              {pick.breakdownLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </article>
  );
}

export function PlayerProfileClient({
  profile,
  isOwnProfile = false,
}: PlayerProfileClientProps) {
  const [pickFilter, setPickFilter] = useState<PickFilter>("all");

  const displayTotal =
    profile.hasLiveScoring && profile.pointsBreakdown.provisionalTotalPoints != null
      ? profile.pointsBreakdown.provisionalTotalPoints
      : profile.pointsBreakdown.totalPoints;

  const scoredPicks = useMemo(
    () => profile.picks.filter((p) => p.status === "scored"),
    [profile.picks]
  );

  const filterCounts = useMemo(
    () => ({
      all: scoredPicks.length,
      exact: profile.exactScores,
      correct: profile.correctResults - profile.exactScores,
      miss: profile.pickStats.wrong,
    }),
    [scoredPicks.length, profile.exactScores, profile.correctResults, profile.pickStats.wrong]
  );

  const filteredPicks = useMemo(() => {
    if (pickFilter === "all") return profile.picks;
    if (pickFilter === "exact") {
      return profile.picks.filter(
        (p) => p.status === "scored" && p.exactScore
      );
    }
    if (pickFilter === "correct") {
      return profile.picks.filter(
        (p) => p.status === "scored" && p.correctResult && !p.exactScore
      );
    }
    return profile.picks.filter(
      (p) => p.status === "scored" && !p.correctResult
    );
  }, [profile.picks, pickFilter]);

  const pb = profile.pointsBreakdown;

  return (
    <div className="space-y-5">
      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-1 text-xs font-semibold text-gold-light hover:text-gold transition-colors"
      >
        ← Back to leaderboard
      </Link>

      <header className="card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-0.5">
            {profile.rank <= 3 ? (
              <RankMedal
                rank={profile.rank}
                trophySize={profile.rank === 1 ? "leaderboardHero" : "leaderboard"}
              />
            ) : (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 text-lg font-extrabold text-usa">
                #{profile.rank}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 flex-wrap">
              <PlayerPodiumFlags
                picks={profile.podiumPicks}
                fallbackEmoji={profile.avatarEmoji}
                size="sm"
                className="!w-auto"
              />
              <span className="text-xl font-extrabold text-usa">{profile.displayName}</span>
              {profile.paid && (
                <span
                  className="text-xs font-bold text-mexico"
                  title="In the prize pool"
                >
                  $
                </span>
              )}
            </p>
            <p className="text-sm text-ink-muted mt-1">
              {isOwnProfile && (
                <>
                  {profile.picksMade} picks ·{" "}
                </>
              )}
              {profile.exactScores} exact ·{" "}
              {profile.correctResults - profile.exactScores} other correct ·{" "}
              {profile.pickStats.wrong} wrong
              <span className="text-ink-faint">
                {" "}
                · {profile.pointsBreakdown.matchPoints} match pts
              </span>
            </p>
            <RecentPickFormDots
              form={profile.recentForm ?? []}
              className="mt-2"
            />
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-extrabold text-gold-gradient tabular-nums leading-none">
              {displayTotal}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint mt-0.5">
              pts
            </p>
            {profile.hasLiveScoring && (pb.livePoints ?? 0) > 0 && (
              <p className="text-[10px] font-semibold text-mexico mt-1">
                +{pb.livePoints} live
              </p>
            )}
            {profile.entry.projectedPrize > 0 && profile.paid && (
              <p className="text-xs font-bold text-mexico mt-1">
                {formatMoney(profile.entry.projectedPrize)}
              </p>
            )}
          </div>
        </div>
      </header>

      <LeaderboardProgressionChart
        progression={profile.leaderboardProgression}
        variant="profile"
        highlightPlayerId={profile.playerId}
        title={`${profile.displayName.split(" ")[0] ?? profile.displayName}'s standings`}
      />

      {profile.podiumPicks && (
        <ProfilePodiumShowcase
          podiumPicks={profile.podiumPicks}
          championPoints={pb.championPickPoints}
          runnerUpPoints={pb.runnerUpPickPoints}
          thirdPoints={pb.thirdPlacePickPoints}
          playerName={profile.displayName.split(" ")[0] ?? profile.displayName}
          isOwnProfile={isOwnProfile}
        />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="section-title">Pick history</h2>
          {isOwnProfile && (
            <span className="text-xs text-ink-faint tabular-nums">
              {filteredPicks.length} picks
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              ["all", `All (${filterCounts.all})`],
              ["exact", `Exact (${filterCounts.exact})`],
              ["correct", `Correct (${filterCounts.correct})`],
              ["miss", `Miss (${filterCounts.miss})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPickFilter(key)}
              className={`filter-pill ${pickFilter === key ? "filter-pill-active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredPicks.length === 0 ? (
          <div className="card text-center py-8 text-sm text-ink-muted">
            No picks in this view yet
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPicks.map((pick) => (
              <PickCard key={pick.matchId} pick={pick} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
