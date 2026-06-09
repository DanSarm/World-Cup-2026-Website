import { championProbabilityToLongshotBonus } from "./odds/math";

export type PodiumPlace = "first" | "second" | "third";

const PODIUM_BASE_POINTS: Record<PodiumPlace, number> = {
  first: 25,
  second: 15,
  third: 10,
};

export const PODIUM_FORM_PLACE: Record<string, PodiumPlace> = {
  firstPlaceTeamId: "first",
  secondPlaceTeamId: "second",
  thirdPlaceTeamId: "third",
};

/** Max points if this podium slot is guessed correctly. */
export function previewPodiumPlacePoints(
  place: PodiumPlace,
  teamId: string,
  championProbabilities?: Record<string, number>
): number {
  let points = PODIUM_BASE_POINTS[place];
  if (place === "first") {
    const prob = championProbabilities?.[teamId];
    if (prob !== undefined && prob > 0) {
      points += championProbabilityToLongshotBonus(prob);
    }
  }
  return points;
}
