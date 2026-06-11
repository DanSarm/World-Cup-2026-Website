import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/auth";
import { getLeaderboardData, getMatchesWithTeams, getPredictions, getConfirmedMatchPicks, getTeams, getMyTournamentPodium, getPlayers } from "@/lib/data";
import { calculatePrizePool } from "@/lib/payouts";
import { findNextUpcomingMatches } from "@/lib/nextPick";
import { scoringConfigFromSettings } from "@/lib/scoringConfig";
import { getWorldCupKickoff, isTournamentPodiumLocked } from "@/lib/utils";
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
  const liveMatch = findLiveMatch(matches);
  const upcomingMatches = findNextUpcomingMatches(matches, 2);
  const worldCupKickoff = getWorldCupKickoff(matches);
  const podiumLocked = isTournamentPodiumLocked(settings, matches);

  const matchIdsToLoad = [
    ...(liveMatch ? [liveMatch.id] : []),
    ...upcomingMatches.map((m) => m.id),
  ];
  const communityPicksByMatchId = new Map(
    await Promise.all(
      matchIdsToLoad.map(async (id) => [id, await getConfirmedMatchPicks(id)] as const)
    )
  );

  const totalPlayers = players.length;
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

      {liveMatch && (
        <HomeFeaturedMatchSection
          match={liveMatch}
          prediction={predMap.get(liveMatch.id)}
          picks={communityPicksByMatchId.get(liveMatch.id) ?? []}
          currentPlayerId={session.id}
          scoringConfig={scoringConfig}
          totalPlayers={totalPlayers}
        />
      )}

      {upcomingMatches.map((match, index) => (
        <HomeFeaturedMatchSection
          key={match.id}
          match={match}
          prediction={predMap.get(match.id)}
          picks={communityPicksByMatchId.get(match.id) ?? []}
          currentPlayerId={session.id}
          scoringConfig={scoringConfig}
          sectionLabel={index === 0 ? "Next game" : "Up next"}
          totalPlayers={totalPlayers}
        />
      ))}

      {!liveMatch && upcomingMatches.length === 0 && <AllPicksDoneHero />}

      <HomeTopFive
        initialEntries={leaderboard}
        prizePool={prizePool}
        pollLive={isAnyMatchInPlayWindow(matches)}
      />
    </div>
  );
}
