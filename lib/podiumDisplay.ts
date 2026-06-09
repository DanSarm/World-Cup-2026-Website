import type {
  Team,
  TournamentPodiumPrediction,
  PlayerPodiumDisplay,
} from "./types";

export type { PlayerPodiumDisplay, PodiumTeamRef } from "./types";

export function resolvePlayerPodium(
  prediction: TournamentPodiumPrediction | undefined | null,
  teams: Team[]
): PlayerPodiumDisplay | null {
  if (!prediction) return null;

  const find = (teamId: string | null) => {
    if (!teamId) return null;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return null;
    return {
      fifa_code: team.fifa_code,
      short_name: team.short_name,
      name: team.name,
    };
  };

  const first = find(prediction.first_place_team_id);
  const second = find(prediction.second_place_team_id);
  const third = find(prediction.third_place_team_id);

  if (!first && !second && !third) return null;

  return { first, second, third };
}

export function hasPodiumDisplay(
  picks: PlayerPodiumDisplay | null | undefined
): picks is PlayerPodiumDisplay {
  if (!picks) return false;
  return picks.first != null || picks.second != null || picks.third != null;
}
