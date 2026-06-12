import { getSupabase } from "./supabaseServer";
import { isMatchLocked } from "./utils";
import type { Match, MatchPrediction, Player } from "./types";

export type DefaultPickRow = {
  player_id: string;
  match_id: string;
  pred_home_score: number;
  pred_away_score: number;
  pred_winner_team_id: null;
  pick_confirmed: boolean;
  updated_at: string;
};

/** Locked matches where the player has no prediction row at all. */
export function listMissingDefaultPickRows(
  matches: Match[],
  players: Player[],
  predictions: MatchPrediction[]
): DefaultPickRow[] {
  const lockedMatches = matches.filter(
    (m) => m.home_team_id && m.away_team_id && isMatchLocked(m)
  );
  if (lockedMatches.length === 0 || players.length === 0) return [];

  const existingKeys = new Set<string>();
  for (const prediction of predictions) {
    existingKeys.add(`${prediction.player_id}:${prediction.match_id}`);
  }

  const now = new Date().toISOString();
  const rows: DefaultPickRow[] = [];

  for (const match of lockedMatches) {
    for (const player of players) {
      const key = `${player.id}:${match.id}`;
      if (existingKeys.has(key)) continue;

      rows.push({
        player_id: player.id,
        match_id: match.id,
        pred_home_score: 0,
        pred_away_score: 0,
        pred_winner_team_id: null,
        pick_confirmed: true,
        updated_at: now,
      });
    }
  }

  return rows;
}

async function insertDefaultPickRows(rows: DefaultPickRow[]): Promise<void> {
  if (rows.length === 0) return;

  const supabase = getSupabase();
  const chunkSize = 200;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    let { error } = await supabase.from("match_predictions").insert(chunk);

    if (error?.message.includes("pick_confirmed")) {
      const legacyChunk = chunk.map(({ pick_confirmed: _confirmed, ...row }) => row);
      ({ error } = await supabase.from("match_predictions").insert(legacyChunk));
    }

    // Unique violation means another request inserted first — safe to ignore.
    if (error && !error.message.includes("duplicate key")) {
      console.error("ensureDefaultPredictionsForLockedMatches:", error.message);
    }
  }
}

/** Inserts confirmed 0-0 picks only when no row exists for that player/match. */
export async function ensureDefaultPredictionsForLockedMatches(
  matches: Match[],
  players: Player[],
  predictions: MatchPrediction[]
): Promise<void> {
  const rows = listMissingDefaultPickRows(matches, players, predictions);
  await insertDefaultPickRows(rows);
}

export async function ensureDefaultPredictionsForPlayer(
  playerId: string,
  matches: Match[],
  predictions: MatchPrediction[]
): Promise<void> {
  const player = { id: playerId } as Player;
  await ensureDefaultPredictionsForLockedMatches(
    matches,
    [player],
    predictions
  );
}
