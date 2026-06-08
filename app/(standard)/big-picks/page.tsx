import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTeams, getMatchesWithTeams } from "@/lib/data";
import { getSettings } from "@/lib/auth";
import { getSupabase } from "@/lib/supabaseServer";
import { BigPicksClient } from "@/components/BigPicksClient";
import { isMatchLocked } from "@/lib/utils";
import type { BigPrediction, FinalsChallengePrediction } from "@/lib/types";

export default async function BigPicksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [teams, settings, matches] = await Promise.all([
    getTeams(),
    getSettings(),
    getMatchesWithTeams(),
  ]);

  const supabase = getSupabase();
  const { data: bigPick } = await supabase
    .from("big_predictions")
    .select("*")
    .eq("player_id", session.id)
    .maybeSingle();

  const { data: finalsPick } = await supabase
    .from("finals_challenge_predictions")
    .select("*")
    .eq("player_id", session.id)
    .maybeSingle();

  const firstMatchStarted = matches.some((m) => isMatchLocked(m));

  return (
    <BigPicksClient
      teams={teams}
      myBigPick={bigPick as BigPrediction | null}
      myFinalsPick={finalsPick as FinalsChallengePrediction | null}
      bigLocked={settings.big_predictions_locked}
      finalsOpen={settings.finals_challenge_open}
      firstMatchStarted={firstMatchStarted}
    />
  );
}
