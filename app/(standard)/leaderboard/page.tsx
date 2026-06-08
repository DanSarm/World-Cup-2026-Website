import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getLeaderboardData,
  getPredictions,
  computeFunStats,
} from "@/lib/data";
import { LeaderboardClient } from "@/components/LeaderboardClient";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { leaderboard, finalsLeaderboard, settings, matches } =
    await getLeaderboardData();
  const predictions = await getPredictions();
  const funStats = computeFunStats(leaderboard, matches, predictions, settings);

  return (
    <LeaderboardClient
      leaderboard={leaderboard}
      finalsLeaderboard={finalsLeaderboard}
      funStats={funStats}
      isAdmin={session.is_admin}
      prizeLabel={settings.tournament_complete ? "Won" : "Projected"}
    />
  );
}
