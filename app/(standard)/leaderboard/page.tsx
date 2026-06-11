import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getLeaderboardData,
  getPredictions,
  computeFunStats,
  getPlayers,
  getMatchesWithTeams,
} from "@/lib/data";
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
  if (liveMatchesInitial.length > 0) {
    await syncLiveScores();
  }

  const [{ leaderboard, settings, matches }, players, predictions] =
    await Promise.all([
      liveMatchesInitial.length > 0
        ? getLeaderboardData({ includeLiveScores: true })
        : getLeaderboardData(),
      getPlayers(),
      getPredictions(),
    ]);
  const funStats = computeFunStats(leaderboard, matches, predictions, settings);
  const paidCount = players.filter((p) => p.paid).length;
  const prizePool = calculatePrizePool(paidCount);

  return (
    <LeaderboardClient
      leaderboard={leaderboard}
      prizePool={prizePool}
      funStats={funStats}
      pollLive={isAnyMatchInPlayWindow(matches)}
      initialHasLiveScoring={hasAnyDisplayableLiveScore(matches)}
    />
  );
}
