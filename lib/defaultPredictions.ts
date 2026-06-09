import { getSupabase } from "./supabaseServer";
import { isConfirmedPick } from "./pickUtils";
import { isMatchLocked } from "./utils";
import type { Match, MatchPrediction, Player } from "./types";

/** Persist 0-0 confirmed picks for anyone who missed the lock window. */
export async function ensureDefaultPredictionsForLockedMatches(
  matches: Match[],
  players: Player[],
  predictions: MatchPrediction[]
): Promise<void> {
  const supabase = getSupabase();
  const lockedMatches = matches.filter(
    (m) =>
      isMatchLocked(m) &&
      m.home_team_id &&
      m.away_team_id
  );

  if (!lockedMatches.length || !players.length) return;

  const confirmedKeys = new Set(
    predictions.filter(isConfirmedPick).map((p) => `${p.player_id}:${p.match_id}`)
  );

  const rows: Array<{
    player_id: string;
    match_id: string;
    pred_home_score: number;
    pred_away_score: number;
    pred_winner_team_id: null;
    pick_confirmed: boolean;
    points: number;
    exact_score: boolean;
    correct_result: boolean;
  }> = [];

  for (const match of lockedMatches) {
    for (const player of players) {
      const key = `${player.id}:${match.id}`;
      if (confirmedKeys.has(key)) continue;
      rows.push({
        player_id: player.id,
        match_id: match.id,
        pred_home_score: 0,
        pred_away_score: 0,
        pred_winner_team_id: null,
        pick_confirmed: true,
        points: 0,
        exact_score: false,
        correct_result: false,
      });
    }
  }

  if (!rows.length) return;

  await supabase.from("match_predictions").upsert(rows, {
    onConflict: "player_id,match_id",
  });
}

/** Persist 0-0 defaults for one player (e.g. on /picks load). */
export async function ensureDefaultPredictionsForPlayer(
  playerId: string,
  matches: Match[],
  predictions: MatchPrediction[]
): Promise<void> {
  if (!playerId) return;
  await ensureDefaultPredictionsForLockedMatches(
    matches,
    [{ id: playerId } as Player],
    predictions.filter((p) => p.player_id === playerId)
  );
}
