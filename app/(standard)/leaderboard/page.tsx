import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getLeaderboardData,
  getPredictions,
  getMatchesWithTeams,
  getTournamentPodiumPredictions,
  getFinalsPredictions,
  getAdjustments,
  getActualResults,
  getTeams,
} from "@/lib/data";
import { computePoolHighlights } from "@/lib/poolHighlights";
import { calculatePrizePool } from "@/lib/payouts";
import { LeaderboardClient } from "@/components/LeaderboardClient";
import {
  findCurrentlyPlayingMatches,
  isAnyMatchInPlayWindow,
  hasAnyDisplayableLiveScore,
} from "@/lib/matchLive";
import { syncLiveScores } from "@/lib/scores/sync";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const matchesRaw = await getMatchesWithTeams();
  const liveMatchesInitial = findCurrentlyPlayingMatches(matchesRaw);
  if (isAnyMatchInPlayWindow(matchesRaw)) {
    await syncLiveScores();
  }

  const [
    { leaderboard, settings, matches, players },
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    actualResults,
    teams,
  ] = await Promise.all([
    liveMatchesInitial.length > 0
      ? getLeaderboardData({ includeLiveScores: true })
      : getLeaderboardData(),
    getPredictions(),
    getTournamentPodiumPredictions(),
    getFinalsPredictions(),
    getAdjustments(),
    getActualResults(),
    getTeams(),
  ]);

  const poolHighlights = computePoolHighlights({
    players,
    matches,
    predictions,
    settings,
    leaderboard,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    actualResults,
    teams,
  });

  const paidCount = players.filter((p) => p.paid).length;
  const prizePool = calculatePrizePool(paidCount);

  return (
    <LeaderboardClient
      leaderboard={leaderboard}
      prizePool={prizePool}
      poolHighlights={poolHighlights}
      pollLive={isAnyMatchInPlayWindow(matches)}
      initialHasLiveScoring={hasAnyDisplayableLiveScore(matches)}
    />
  );
}
