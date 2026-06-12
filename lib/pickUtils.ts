import type { Match, MatchPrediction, TournamentPodiumPrediction } from "./types";
import { isMatchLocked } from "./utils";

const DEFAULT_MISSING_PICK = {
  pred_home_score: 0,
  pred_away_score: 0,
  pred_winner_team_id: null,
} as const;

/** Counts saved picks; only explicit `pick_confirmed: false` is excluded (legacy placeholders). */
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

/** Saved pick, or 0-0 once the match has started and no pick was submitted. */
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

  if (isMatchLocked(match)) {
    return { ...DEFAULT_MISSING_PICK };
  }

  return null;
}

export function usesDefaultMissingPick(
  match: Pick<Match, "status" | "kickoff_at">,
  prediction?: MatchPrediction | null
): boolean {
  return isMatchLocked(match) && (!prediction || !isConfirmedPick(prediction));
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
