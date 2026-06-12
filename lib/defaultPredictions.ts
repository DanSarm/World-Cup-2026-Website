import type { Match, MatchPrediction, Player } from "./types";

/**
 * Missing picks stay unscored — never auto-insert 0-0 defaults.
 * A June 2026 backfill that upserted 0-0 wiped confirmed picks; see lib/predictionGuard.ts.
 */
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
