import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getLeaderboardData,
  getPredictions,
  computeFunStats,
  getPlayers,
} from "@/lib/data";
import { calculatePrizePool } from "@/lib/payouts";
import { LeaderboardClient } from "@/components/LeaderboardClient";
import { isAnyMatchInPlayWindow } from "@/lib/matchLive";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ leaderboard, settings, matches }, players, predictions] =
    await Promise.all([
      getLeaderboardData(),
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
    />
  );
}
