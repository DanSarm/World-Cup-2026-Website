import type { MatchPrediction } from "./types";

/** True only when the player explicitly locked/saved this pick. */
export function isConfirmedPick(prediction: MatchPrediction): boolean {
  return prediction.pick_confirmed === true;
}

export function hasSavedPick(
  prediction?: MatchPrediction | null
): boolean {
  if (!prediction) return false;
  return isConfirmedPick(prediction);
}
