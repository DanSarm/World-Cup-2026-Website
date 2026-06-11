import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/auth";
import {
  getMatchesWithTeams,
  getPredictions,
  getTeams,
  getMyTournamentPodium,
} from "@/lib/data";
import { scoringConfigFromSettings } from "@/lib/scoringConfig";
import { getWorldCupKickoff, isTournamentPodiumLocked } from "@/lib/utils";
import { resolveMatchesForPicks } from "@/lib/resolvedMatches";
import { PicksClient } from "@/components/PicksClient";

export default async function PicksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [matches, settings, teams, myPodium] = await Promise.all([
    getMatchesWithTeams(),
    getSettings(),
    getTeams(),
    getMyTournamentPodium(session.id),
  ]);

  const predictions = await getPredictions(session.id);

  const scoringConfig = scoringConfigFromSettings(settings);
  const podiumLocked = isTournamentPodiumLocked(settings, matches);
  const worldCupKickoff = getWorldCupKickoff(matches);

  const pickMatches = resolveMatchesForPicks(matches);

  return (
    <PicksClient
      matches={pickMatches}
      predictions={predictions}
      scoringConfig={scoringConfig}
      teams={teams}
      myPodium={myPodium}
      podiumLocked={podiumLocked}
      worldCupKickoff={worldCupKickoff}
    />
  );
}
