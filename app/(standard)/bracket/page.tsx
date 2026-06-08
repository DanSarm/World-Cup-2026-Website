import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMatchesWithTeams, getPredictions } from "@/lib/data";
import { BracketClient } from "@/components/BracketClient";

export default async function BracketPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [matches, predictions] = await Promise.all([
    getMatchesWithTeams(),
    getPredictions(session.id),
  ]);

  return <BracketClient matches={matches} predictions={predictions} />;
}
