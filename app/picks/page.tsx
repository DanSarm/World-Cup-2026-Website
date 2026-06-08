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
import { isMatchLocked, getWorldCupKickoff } from "@/lib/utils";
import { PicksClient } from "@/components/PicksClient";

export default async function PicksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [matches, predictions, settings, teams, myPodium] = await Promise.all([
    getMatchesWithTeams(),
    getPredictions(session.id),
    getSettings(),
    getTeams(),
    getMyTournamentPodium(session.id),
  ]);

  const scoringConfig = scoringConfigFromSettings(settings);
  const firstMatchStarted = matches.some((m) => isMatchLocked(m));
  const podiumLocked = settings.big_predictions_locked || firstMatchStarted;
  const worldCupKickoff = getWorldCupKickoff(matches);

  return (
    <PicksClient
      matches={matches}
      predictions={predictions}
      scoringConfig={scoringConfig}
      teams={teams}
      myPodium={myPodium}
      podiumLocked={podiumLocked}
      worldCupKickoff={worldCupKickoff}
    />
  );
}
