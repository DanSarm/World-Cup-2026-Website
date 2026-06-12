import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPlayerProfileData } from "@/lib/playerProfile";
import { PlayerProfileClient } from "@/components/PlayerProfileClient";

interface PlayerProfilePageProps {
  params: Promise<{ playerId: string }>;
}

export default async function PlayerProfilePage({
  params,
}: PlayerProfilePageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { playerId } = await params;
  const profile = await getPlayerProfileData(playerId);
  if (!profile) notFound();

  return <PlayerProfileClient profile={profile} />;
}
