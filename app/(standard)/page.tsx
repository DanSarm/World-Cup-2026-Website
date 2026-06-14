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
import { findCurrentlyPlayingMatches, isAnyMatchNeedingScoreSync, hasAnyDisplayableLiveScore } from "@/lib/matchLive";
import { syncLiveScores } from "@/lib/scores/sync";
import { filterCommunityPicksForViewer } from "@/lib/pickVisibility";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ leaderboard: leaderboardInitial }, matchesRaw, predictions, settings, teams, myPodium, players] = await Promise.all([
    getLeaderboardData(),
    getMatchesWithTeams(),
    getPredictions(session.id),
    getSettings(),
    getTeams(),
    getMyTournamentPodium(session.id),
    getPlayers(),
  ]);

  const liveMatchesInitial = findCurrentlyPlayingMatches(matchesRaw);
  if (isAnyMatchNeedingScoreSync(matchesRaw)) {
    await syncLiveScores(true);
  }
  const matches =
    liveMatchesInitial.length > 0 ? await getMatchesWithTeams() : matchesRaw;
  const { leaderboard } =
    liveMatchesInitial.length > 0
      ? await getLeaderboardData({ includeLiveScores: true })
      : { leaderboard: leaderboardInitial };

  const prizePool = calculatePrizePool(players.filter((p) => p.paid).length);

  const scoringConfig = scoringConfigFromSettings(settings);
  const predMap = new Map(predictions.map((p) => [p.match_id, p]));
  const liveMatches = findCurrentlyPlayingMatches(matches);
  const featuredLiveMatches = liveMatches.slice(0, 1);
  const liveMatchIds = new Set(liveMatches.map((m) => m.id));
  const upcomingLimit = featuredLiveMatches.length > 0 ? 1 : 2;
  const upcomingMatches = findNextUpcomingMatches(
    matches,
    upcomingLimit,
    liveMatchIds
  );
  const worldCupKickoff = getWorldCupKickoff(matches);
  const podiumLocked = isTournamentPodiumLocked(settings, matches);

  const matchIdsToLoad = [
    ...featuredLiveMatches.map((m) => m.id),
    ...upcomingMatches.map((m) => m.id),
  ];
  const communityPicksByMatchId = new Map(
    await Promise.all(
      matchIdsToLoad.map(async (id) => [id, await getConfirmedMatchPicks(id)] as const)
    )
  );
  const communityPickCountsByMatchId = Object.fromEntries(
    [...communityPicksByMatchId.entries()].map(([id, picks]) => [id, picks.length])
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

      {featuredLiveMatches.map((match) => (
        <HomeFeaturedMatchSection
          key={match.id}
          match={match}
          prediction={predMap.get(match.id)}
          picks={filterCommunityPicksForViewer(
            communityPicksByMatchId.get(match.id) ?? [],
            match,
            session.id
          )}
          currentPlayerId={session.id}
          scoringConfig={scoringConfig}
          sectionLabel="Live now"
          totalPlayers={totalPlayers}
          predictedCount={communityPickCountsByMatchId[match.id]}
        />
      ))}

      {upcomingMatches.map((match) => (
        <HomeFeaturedMatchSection
          key={match.id}
          match={match}
          prediction={predMap.get(match.id)}
          picks={filterCommunityPicksForViewer(
            communityPicksByMatchId.get(match.id) ?? [],
            match,
            session.id
          )}
          currentPlayerId={session.id}
          scoringConfig={scoringConfig}
          sectionLabel="Next game"
          totalPlayers={totalPlayers}
          predictedCount={communityPickCountsByMatchId[match.id]}
        />
      ))}

      {featuredLiveMatches.length === 0 && upcomingMatches.length === 0 && (
        <AllPicksDoneHero />
      )}

      <HomeTopFive
        initialEntries={leaderboard}
        prizePool={prizePool}
        matches={matches}
        initialHasLiveScoring={hasAnyDisplayableLiveScore(matches)}
      />
    </div>
  );
}
