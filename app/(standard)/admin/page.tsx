import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPlayers, getTeams } from "@/lib/data";
import { calculatePrizePool } from "@/lib/payouts";
import { AdminPayments } from "@/components/AdminPayments";
import { AdminMarketOdds } from "@/components/AdminMarketOdds";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.is_admin) redirect("/");

  const [players, teams] = await Promise.all([getPlayers(), getTeams()]);
  const paidCount = players.filter((p) => p.paid).length;
  const prizePool = calculatePrizePool(paidCount);

  return (
    <div className="space-y-8">
      <AdminPayments players={players} prizePool={prizePool} />
      <AdminMarketOdds teams={teams} />
    </div>
  );
}
