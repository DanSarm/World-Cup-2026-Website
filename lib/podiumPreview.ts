import type { Team } from "./types";
import {
  tournamentPlacePoints,
  type TournamentPickPlace,
} from "./tournamentValue";

export type PodiumPlace = "first" | "second" | "third";

const PLACE_TO_PICK_PLACE: Record<PodiumPlace, TournamentPickPlace> = {
  first: "champion",
  second: "runnerUp",
  third: "thirdPlace",
};

export const PODIUM_FORM_PLACE: Record<string, PodiumPlace> = {
  firstPlaceTeamId: "first",
  secondPlaceTeamId: "second",
  thirdPlaceTeamId: "third",
};

/** Points if this Tournament Pick slot is exactly correct. */
export function previewPodiumPlacePoints(
  place: PodiumPlace,
  team: Pick<Team, "market_win_percentage" | "tournament_value_override"> | null | undefined
): number {
  return tournamentPlacePoints(team, PLACE_TO_PICK_PLACE[place]);
}
