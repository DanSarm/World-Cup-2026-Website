import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/auth";
import { getLeaderboardData, getMatchesWithTeams, getPredictions, getConfirmedMatchPicks, getTeams, getMyTournamentPodium } from "@/lib/data";
import { findNextUpcomingMatch } from "@/lib/nextPick";
import { scoringConfigFromSettings } from "@/lib/scoringConfig";
import { getWorldCupKickoff, isMatchLocked } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { AllPicksDoneHero } from "@/components/AllPicksDoneHero";
import { MatchCard } from "@/components/MatchCard";
import { MatchCommunityPicks } from "@/components/MatchCommunityPicks";
import { TournamentPodiumCard } from "@/components/TournamentPodiumCard";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ leaderboard }, matches, predictions, settings, teams, myPodium] = await Promise.all([
    getLeaderboardData(),
    getMatchesWithTeams(),
    getPredictions(session.id),
    getSettings(),
    getTeams(),
    getMyTournamentPodium(session.id),
  ]);

  const scoringConfig = scoringConfigFromSettings(settings);
  const predMap = new Map(predictions.map((p) => [p.match_id, p]));
  const upcomingMatch = findNextUpcomingMatch(matches);
  const worldCupKickoff = getWorldCupKickoff(matches);
  const firstMatchStarted = matches.some((m) => isMatchLocked(m));
  const podiumLocked = settings.big_predictions_locked || firstMatchStarted;
  const communityPicks = upcomingMatch
    ? await getConfirmedMatchPicks(upcomingMatch.id)
    : [];
  const top5 = leaderboard.slice(0, 5);

  const missingKickoffs = matches.some((m) => !m.kickoff_at);

  return (
    <div className="space-y-6">
      <PageHeader
        logo
        title="Family Cup 2026"
        subtitle="Pick scores. Win points. · Every game counts."
      />

      {missingKickoffs && session.is_admin && (
        <div className="alert-warning">
          ⚠️ Kickoff times missing — add times before launch
        </div>
      )}

      <TournamentPodiumCard
        teams={teams}
        myPodium={myPodium}
        locked={podiumLocked}
        worldCupKickoff={worldCupKickoff}
      />

      {upcomingMatch ? (
        <section className="space-y-3">
          <h2 className="section-title px-0.5">Upcoming Game</h2>
          <MatchCard
            match={upcomingMatch}
            prediction={predMap.get(upcomingMatch.id)}
            scoringConfig={scoringConfig}
            showPickCountdown
          />
          <MatchCommunityPicks
            match={upcomingMatch}
            picks={communityPicks}
            currentPlayerId={session.id}
          />
        </section>
      ) : (
        <AllPicksDoneHero />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="section-title">Top 5</h2>
          <Link
            href="/leaderboard"
            className="text-xs font-semibold text-gold-light hover:text-gold transition-colors"
          >
            See all →
          </Link>
        </div>
        <div className="card p-0 overflow-hidden">
          {top5.map((entry) => (
            <div key={entry.playerId} className="lb-row">
              <span className="w-7 text-center font-bold text-ink-faint text-sm">
                {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
              </span>
              <span className="flex-1 font-semibold text-ink truncate">
                {entry.avatarEmoji} {entry.displayName}
              </span>
              <span className="font-extrabold text-usa tabular-nums">
                {entry.totalPoints}
                <span className="text-xs font-normal text-ink-faint ml-0.5">pts</span>
              </span>
            </div>
          ))}
          {top5.length === 0 && (
            <p className="text-center text-ink-faint py-6 text-sm">No players yet</p>
          )}
        </div>
      </section>
    </div>
  );
}
