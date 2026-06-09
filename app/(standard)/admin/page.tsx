import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPlayers } from "@/lib/data";
import { calculatePrizePool } from "@/lib/payouts";
import { AdminPayments } from "@/components/AdminPayments";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.is_admin) redirect("/");

  const players = await getPlayers();
  const paidCount = players.filter((p) => p.paid).length;
  const prizePool = calculatePrizePool(paidCount);

  return <AdminPayments players={players} prizePool={prizePool} />;
}
