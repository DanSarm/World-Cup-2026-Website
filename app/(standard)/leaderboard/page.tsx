import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getLeaderboardData, getPredictions, getTournamentPodiumPredictions, getFinalsPredictions, getAdjustments, getActualResults, getTeams } from "@/lib/data";
import { buildLeaderboardProgression } from "@/lib/leaderboardProgression";
import { calculatePrizePool } from "@/lib/payouts";
import { LeaderboardClient } from "@/components/LeaderboardClient";
import {
  isAnyMatchNeedingScoreSync,
  hasAnyDisplayableLiveScore,
} from "@/lib/matchLive";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [
    { leaderboard, settings, matches, players },
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    actualResults,
    teams,
  ] = await Promise.all([
    getLeaderboardData({ skipScoreSync: true }),
    getPredictions(),
    getTournamentPodiumPredictions(),
    getFinalsPredictions(),
    getAdjustments(),
    getActualResults(),
    getTeams(),
  ]);

  const progression = buildLeaderboardProgression(
    players,
    matches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    teams
  );

  const paidPlayerIds = players.filter((p) => p.paid).map((p) => p.id);
  const paidCount = paidPlayerIds.length;
  const prizePool = calculatePrizePool(paidCount);

  return (
    <LeaderboardClient
      leaderboard={leaderboard}
      prizePool={prizePool}
      progression={progression}
      paidPlayerIds={paidPlayerIds}
      currentPlayerId={session.id}
      pollLive={isAnyMatchNeedingScoreSync(matches)}
      initialHasLiveScoring={hasAnyDisplayableLiveScore(matches)}
    />
  );
}
