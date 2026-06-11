import type { Match, MatchPrediction, TournamentPodiumPrediction } from "./types";

/** Counts saved picks; only explicit `pick_confirmed: false` is excluded (auto placeholders). */
export function isConfirmedPick(prediction: MatchPrediction): boolean {
  return prediction.pick_confirmed !== false;
}

export function hasSavedPick(
  prediction?: MatchPrediction | null
): boolean {
  if (!prediction) return false;
  return isConfirmedPick(prediction);
}

export type EffectivePickScores = Pick<
  MatchPrediction,
  "pred_home_score" | "pred_away_score" | "pred_winner_team_id"
>;

/** Saved pick only — missing picks are not scored as 0-0. */
export function getEffectiveMatchPrediction(
  match: Pick<Match, "status" | "kickoff_at">,
  prediction?: MatchPrediction | null
): EffectivePickScores | null {
  if (prediction && isConfirmedPick(prediction)) {
    return {
      pred_home_score: prediction.pred_home_score,
      pred_away_score: prediction.pred_away_score,
      pred_winner_team_id: prediction.pred_winner_team_id,
    };
  }

  return null;
}

/** @deprecated Missing picks no longer default to 0-0. */
export function usesDefaultMissingPick(
  _match: Pick<Match, "status" | "kickoff_at">,
  prediction?: MatchPrediction | null
): boolean {
  return false;
}

export function isPodiumIncomplete(
  myPodium?: TournamentPodiumPrediction | null
): boolean {
  if (!myPodium) return true;
  return (
    !myPodium.first_place_team_id ||
    !myPodium.second_place_team_id ||
    !myPodium.third_place_team_id
  );
}
