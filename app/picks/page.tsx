import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/auth";
import {
  getMatchesWithTeams,
  getPredictions,
  getTeams,
  getMyTournamentPodium,
  getConfirmedMatchPicksByMatchIds,
  getPlayers,
} from "@/lib/data";
import { scoringConfigFromSettings } from "@/lib/scoringConfig";
import { getWorldCupKickoff, isTournamentPodiumLocked } from "@/lib/utils";
import { resolveMatchesForPicks } from "@/lib/resolvedMatches";
import { PicksClient } from "@/components/PicksClient";

export default async function PicksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [matches, settings, teams, myPodium, players] = await Promise.all([
    getMatchesWithTeams(),
    getSettings(),
    getTeams(),
    getMyTournamentPodium(session.id),
    getPlayers(),
  ]);

  const predictions = await getPredictions(session.id);

  const scoringConfig = scoringConfigFromSettings(settings);
  const podiumLocked = isTournamentPodiumLocked(settings, matches);
  const worldCupKickoff = getWorldCupKickoff(matches);

  const pickMatches = resolveMatchesForPicks(matches);
  const communityPicksByMatchId = await getConfirmedMatchPicksByMatchIds(
    pickMatches.map((m) => m.id)
  );

  return (
    <PicksClient
      matches={pickMatches}
      predictions={predictions}
      scoringConfig={scoringConfig}
      teams={teams}
      myPodium={myPodium}
      podiumLocked={podiumLocked}
      worldCupKickoff={worldCupKickoff}
      currentPlayerId={session.id}
      totalPlayers={players.length}
      communityPicksByMatchId={Object.fromEntries(communityPicksByMatchId)}
    />
  );
}
