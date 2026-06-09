import { getAllChampionOdds } from "@/lib/odds/championOdds";
import type { Team, TournamentPodiumPrediction } from "@/lib/types";
import { ChampionOddsPanel } from "./ChampionOddsPanel";
import { TournamentPodiumCard } from "./TournamentPodiumCard";

interface HomePodiumSectionProps {
  teams: Team[];
  myPodium?: TournamentPodiumPrediction | null;
  locked: boolean;
  worldCupKickoff: string | null;
  championProbabilities?: Record<string, number>;
}

export async function HomePodiumSection({
  teams,
  myPodium,
  locked,
  worldCupKickoff,
  championProbabilities,
}: HomePodiumSectionProps) {
  const championOdds = await getAllChampionOdds(
    teams,
    championProbabilities
  );

  return (
    <TournamentPodiumCard
      teams={teams}
      myPodium={myPodium}
      locked={locked}
      worldCupKickoff={worldCupKickoff}
      championProbabilities={championProbabilities}
      companion={
        <div className="w-full xl:w-[320px] shrink-0 flex flex-col h-full min-h-0 overflow-hidden">
          <ChampionOddsPanel entries={championOdds} />
        </div>
      }
    />
  );
}
