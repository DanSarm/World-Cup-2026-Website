"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlayerProfileData, PlayerPickSummary } from "@/lib/playerProfile";
import { PlayerPodiumFlags } from "./PlayerPodiumFlags";
import { RecentPickFormDots } from "./RecentPickFormDots";
import { RankMedal } from "./PlaceMedal";
import { ScoreBreakdownList } from "./ScoreBreakdownList";
import { Flag } from "./Flag";
import { formatKickoff } from "@/lib/utils";
import { formatMoney } from "@/lib/payouts";

type PickFilter = "all" | "scored" | "upcoming";

interface PlayerProfileClientProps {
  profile: PlayerProfileData;
}

function formatPickScore(pick: PlayerPickSummary): string {
  const score = `${pick.predHome}–${pick.predAway}`;
  if (pick.predWinnerCode) return `${score} · ${pick.predWinnerCode}`;
  return score;
}

function formatActualScore(pick: PlayerPickSummary): string | null {
  if (pick.actualHome == null || pick.actualAway == null) return null;
  return `${pick.actualHome}–${pick.actualAway}`;
}

function PointsStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  if (value === 0 && !highlight) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-semibold tabular-nums ${highlight ? "text-mexico" : "text-usa"}`}>
        {value > 0 ? `+${value}` : value} pts
      </span>
    </div>
  );
}

function PickCard({ pick }: { pick: PlayerPickSummary }) {
  const actual = formatActualScore(pick);
  const displayPoints =
    pick.status === "live" && pick.livePoints != null
      ? pick.livePoints
      : pick.points;

  return (
    <article className="card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
            #{pick.matchNumber}
            {pick.groupLetter ? ` · Group ${pick.groupLetter}` : ""}
            {" · "}
            {pick.stageLabel}
          </p>
          <p className="font-bold text-usa leading-snug">
            {pick.homeLabel} vs {pick.awayLabel}
          </p>
          {pick.kickoffAt && (
            <p className="text-xs text-ink-muted">{formatKickoff(pick.kickoffAt)}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {pick.status === "live" && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-canada mb-1">
              Live
            </span>
          )}
          {pick.status === "scored" && (
            <span
              className={`inline-block text-[10px] font-bold uppercase tracking-wide mb-1 ${
                pick.exactScore
                  ? "text-mexico"
                  : pick.correctResult
                    ? "text-usa"
                    : "text-ink-faint"
              }`}
            >
              {pick.exactScore ? "Exact" : pick.correctResult ? "Correct" : "Miss"}
            </span>
          )}
          {(pick.status === "scored" || pick.status === "live") && (
            <p className="text-lg font-extrabold text-mexico tabular-nums leading-none">
              {displayPoints}
              <span className="text-[10px] font-semibold text-ink-faint ml-0.5">
                pts
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-ink/[0.03] px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            Their pick
          </p>
          <p className="font-semibold text-usa mt-0.5">{formatPickScore(pick)}</p>
        </div>
        <div className="rounded-lg bg-ink/[0.03] px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            {pick.status === "upcoming" ? "Kickoff" : "Actual"}
          </p>
          <p className="font-semibold text-usa mt-0.5">
            {actual ?? (pick.status === "upcoming" ? "—" : "Pending sync")}
          </p>
        </div>
      </div>

      {pick.breakdownLines.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-gold-light hover:text-gold list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▸</span>
            Score breakdown
          </summary>
          <div className="mt-2 pl-3 border-l-2 border-ink/10">
            <ScoreBreakdownList lines={pick.breakdownLines} />
          </div>
        </details>
      )}
    </article>
  );
}

export function PlayerProfileClient({ profile }: PlayerProfileClientProps) {
  const [pickFilter, setPickFilter] = useState<PickFilter>("all");

  const displayTotal =
    profile.hasLiveScoring && profile.pointsBreakdown.provisionalTotalPoints != null
      ? profile.pointsBreakdown.provisionalTotalPoints
      : profile.pointsBreakdown.totalPoints;

  const filteredPicks = useMemo(() => {
    if (pickFilter === "all") return profile.picks;
    if (pickFilter === "scored") {
      return profile.picks.filter((p) => p.status === "scored" || p.status === "live");
    }
    return profile.picks.filter((p) => p.status === "upcoming");
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
              {profile.picksMade} picks · {profile.exactScores} exact ·{" "}
              {profile.correctResults} correct results
              {profile.perfectDays > 0 && (
                <span className="text-mexico font-semibold">
                  {" "}
                  · Perfect Day{profile.perfectDays > 1 ? ` ×${profile.perfectDays}` : ""} 🎉
                </span>
              )}
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

      {profile.achievements.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title px-0.5">Achievements</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {profile.achievements.map((achievement) => (
              <article
                key={achievement.title}
                className="card p-3 flex items-start gap-2.5"
              >
                <span className="text-xl leading-none" aria-hidden>
                  {achievement.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-usa text-sm">{achievement.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                    {achievement.detail}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="card p-4 space-y-3">
        <h2 className="font-bold text-usa">Points breakdown</h2>
        <div className="space-y-1.5">
          <PointsStat label="Match picks" value={pb.matchPoints} highlight />
          {pb.groupStagePoints > 0 && pb.knockoutPoints > 0 && (
            <>
              <PointsStat label="Group stage" value={pb.groupStagePoints} />
              <PointsStat label="Knockout" value={pb.knockoutPoints} />
            </>
          )}
          <PointsStat label="Hard pick bonuses" value={pb.hardPickBonusPoints} />
          <PointsStat label="Fire bonuses" value={pb.fireBonusPoints} />
          <PointsStat label="Miracle bonuses" value={pb.miraclePoints} />
          <PointsStat label="Tournament podium picks" value={pb.tournamentPickPoints} />
          {pb.championPickPoints > 0 && (
            <PointsStat label="Champion pick" value={pb.championPickPoints} />
          )}
          {pb.runnerUpPickPoints > 0 && (
            <PointsStat label="Runner-up pick" value={pb.runnerUpPickPoints} />
          )}
          {pb.thirdPlacePickPoints > 0 && (
            <PointsStat label="Third place pick" value={pb.thirdPlacePickPoints} />
          )}
          <PointsStat label="Finals challenge" value={pb.finalsChallengePoints} />
          <PointsStat label="Manual adjustments" value={pb.manualAdjustments} />
        </div>
        <div className="border-t border-ink/5 pt-2 flex items-center justify-between">
          <span className="font-bold text-usa">Total</span>
          <span className="text-lg font-extrabold text-mexico tabular-nums">
            {displayTotal} pts
          </span>
        </div>
      </section>

      {profile.podiumPicks && (
        <section className="card p-4 space-y-3">
          <h2 className="font-bold text-usa">Tournament podium picks</h2>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["Champion", profile.podiumPicks.first, pb.championPickPoints],
                ["Runner-up", profile.podiumPicks.second, pb.runnerUpPickPoints],
                ["Third", profile.podiumPicks.third, pb.thirdPlacePickPoints],
              ] as const
            ).map(([label, team, pts]) => (
              <div
                key={label}
                className="rounded-lg bg-ink/[0.03] p-2.5 text-center space-y-1"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                  {label}
                </p>
                {team ? (
                  <>
                    <Flag fifaCode={team.fifa_code} size="md" className="mx-auto" />
                    <p className="text-xs font-semibold text-usa leading-tight">
                      {team.short_name}
                    </p>
                    {pts > 0 && (
                      <p className="text-[10px] font-bold text-mexico">+{pts} pts</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-ink-faint">—</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="section-title">Pick history</h2>
          <span className="text-xs text-ink-faint tabular-nums">
            {filteredPicks.length} picks
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              ["all", "All"],
              ["scored", "Scored"],
              ["upcoming", "Upcoming"],
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
