import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/auth";
import { getMatchesWithTeams, getPredictions } from "@/lib/data";
import { scoringConfigFromSettings } from "@/lib/scoringConfig";
import { PicksClient } from "@/components/PicksClient";

export default async function PicksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [matches, predictions, settings] = await Promise.all([
    getMatchesWithTeams(),
    getPredictions(session.id),
    getSettings(),
  ]);

  const scoringConfig = scoringConfigFromSettings(settings);

  return (
    <PicksClient
      matches={matches}
      predictions={predictions}
      scoringConfig={scoringConfig}
    />
  );
}
