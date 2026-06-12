import { getSupabase } from "./supabaseServer";
import { isConfirmedPick } from "./pickUtils";
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

/** Locked matches with both teams where the player has no saved pick yet. */
export function listMissingDefaultPickRows(
  matches: Match[],
  players: Player[],
  predictions: MatchPrediction[]
): DefaultPickRow[] {
  const lockedMatches = matches.filter(
    (m) => m.home_team_id && m.away_team_id && isMatchLocked(m)
  );
  if (lockedMatches.length === 0 || players.length === 0) return [];

  const confirmedKeys = new Set<string>();
  for (const prediction of predictions) {
    if (isConfirmedPick(prediction)) {
      confirmedKeys.add(`${prediction.player_id}:${prediction.match_id}`);
    }
  }

  const now = new Date().toISOString();
  const rows: DefaultPickRow[] = [];

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
        updated_at: now,
      });
    }
  }

  return rows;
}

async function upsertDefaultPickRows(rows: DefaultPickRow[]): Promise<void> {
  if (rows.length === 0) return;

  const supabase = getSupabase();
  const chunkSize = 200;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    let { error } = await supabase
      .from("match_predictions")
      .upsert(chunk, { onConflict: "player_id,match_id" });

    if (error?.message.includes("pick_confirmed")) {
      const legacyChunk = chunk.map(({ pick_confirmed: _confirmed, ...row }) => row);
      ({ error } = await supabase
        .from("match_predictions")
        .upsert(legacyChunk, { onConflict: "player_id,match_id" }));
    }

    if (error) {
      console.error("ensureDefaultPredictionsForLockedMatches:", error.message);
    }
  }
}

/** Inserts or upgrades missing picks to confirmed 0-0 once a match has started. */
export async function ensureDefaultPredictionsForLockedMatches(
  matches: Match[],
  players: Player[],
  predictions: MatchPrediction[]
): Promise<void> {
  const rows = listMissingDefaultPickRows(matches, players, predictions);
  await upsertDefaultPickRows(rows);
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
