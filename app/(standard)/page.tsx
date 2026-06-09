import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/auth";
import { getLeaderboardData, getMatchesWithTeams, getPredictions, getConfirmedMatchPicks, getTeams, getMyTournamentPodium, getPlayers } from "@/lib/data";
import { calculatePrizePool } from "@/lib/payouts";
import { findNextUpcomingMatch } from "@/lib/nextPick";
import { scoringConfigFromSettings } from "@/lib/scoringConfig";
import { getWorldCupKickoff, isMatchLocked } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { AllPicksDoneHero } from "@/components/AllPicksDoneHero";
import { HomeFeaturedMatchSection } from "@/components/HomeFeaturedMatchSection";
import { HomePodiumSection } from "@/components/HomePodiumSection";
import { HomeTopFive } from "@/components/HomeTopFive";
import { findLiveMatch, isAnyMatchInPlayWindow } from "@/lib/matchLive";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ leaderboard }, matches, predictions, settings, teams, myPodium, players] = await Promise.all([
    getLeaderboardData(),
    getMatchesWithTeams(),
    getPredictions(session.id),
    getSettings(),
    getTeams(),
    getMyTournamentPodium(session.id),
    getPlayers(),
  ]);

  const prizePool = calculatePrizePool(players.filter((p) => p.paid).length);

  const scoringConfig = scoringConfigFromSettings(settings);
  const predMap = new Map(predictions.map((p) => [p.match_id, p]));
  const upcomingMatch = findNextUpcomingMatch(matches);
  const liveMatch = findLiveMatch(matches);
  const featuredMatch = liveMatch ?? upcomingMatch;
  const worldCupKickoff = getWorldCupKickoff(matches);
  const firstMatchStarted = matches.some((m) => isMatchLocked(m));
  const podiumLocked = settings.big_predictions_locked || firstMatchStarted;
  const communityPicks = featuredMatch
    ? await getConfirmedMatchPicks(featuredMatch.id)
    : [];

  const missingKickoffs = matches.some((m) => !m.kickoff_at);

  return (
    <div className="space-y-6">
      <PageHeader
        logo
        title="Family Cup 2026"
        subtitle="Pick scores. Win points. · Every game counts."
        prizePool={prizePool}
      />

      {missingKickoffs && session.is_admin && (
        <div className="alert-warning">
          ⚠️ Kickoff times missing — add times before launch
        </div>
      )}

      <HomePodiumSection
        teams={teams}
        myPodium={myPodium}
        locked={podiumLocked}
        worldCupKickoff={worldCupKickoff}
        championProbabilities={settings.champion_probabilities}
      />

      {featuredMatch ? (
        <HomeFeaturedMatchSection
          match={featuredMatch}
          prediction={predMap.get(featuredMatch.id)}
          picks={communityPicks}
          currentPlayerId={session.id}
          scoringConfig={scoringConfig}
        />
      ) : (
        <AllPicksDoneHero />
      )}

      <HomeTopFive
        initialEntries={leaderboard}
        prizePool={prizePool}
        pollLive={isAnyMatchInPlayWindow(matches)}
      />
    </div>
  );
}
