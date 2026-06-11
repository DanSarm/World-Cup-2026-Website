import type { Match, MatchPrediction, Player } from "./types";

/** Missing picks stay unscored — no auto 0-0 defaults. */
export async function ensureDefaultPredictionsForLockedMatches(
  _matches: Match[],
  _players: Player[],
  _predictions: MatchPrediction[]
): Promise<void> {
  return;
}

export async function ensureDefaultPredictionsForPlayer(
  _playerId: string,
  _matches: Match[],
  _predictions: MatchPrediction[]
): Promise<void> {
  return;
}
