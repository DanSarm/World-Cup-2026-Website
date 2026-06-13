import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getSupabase } from "./supabaseServer";

export type PredictionBackupRow = {
  player_id: string;
  player_name: string;
  match_id: string;
  match_number: number;
  pred_home_score: number;
  pred_away_score: number;
  pred_winner_team_id: string | null;
  pick_confirmed: boolean;
  points: number | null;
  submitted_at: string | null;
  updated_at: string | null;
};

export type PredictionBackupPayload = {
  saved_at: string;
  label: string;
  row_count: number;
  rows: PredictionBackupRow[];
};

type JoinedPlayer = { display_name: string };
type JoinedMatch = { match_number: number };

type PredictionBackupQueryRow = {
  player_id: string;
  match_id: string;
  pred_home_score: number;
  pred_away_score: number;
  pred_winner_team_id: string | null;
  pick_confirmed: boolean;
  points: number | null;
  submitted_at: string | null;
  updated_at: string | null;
  players: JoinedPlayer | JoinedPlayer[] | null;
  matches: JoinedMatch | JoinedMatch[] | null;
};

function firstJoined<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function fetchPredictionBackupRows(): Promise<PredictionBackupRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("match_predictions").select(
    `
      player_id,
      match_id,
      pred_home_score,
      pred_away_score,
      pred_winner_team_id,
      pick_confirmed,
      points,
      submitted_at,
      updated_at,
      players ( display_name ),
      matches ( match_number )
    `
  );

  if (error) throw new Error(error.message);

  return ((data ?? []) as PredictionBackupQueryRow[]).map((row) => {
    const player = firstJoined(row.players);
    const match = firstJoined(row.matches);

    return {
      player_id: row.player_id,
      player_name: player?.display_name ?? "?",
      match_id: row.match_id,
      match_number: match?.match_number ?? 0,
      pred_home_score: row.pred_home_score,
      pred_away_score: row.pred_away_score,
      pred_winner_team_id: row.pred_winner_team_id,
      pick_confirmed: row.pick_confirmed,
      points: row.points,
      submitted_at: row.submitted_at,
      updated_at: row.updated_at,
    };
  });
}

export async function savePredictionSnapshot(
  label: string,
  options?: { writeLocalFile?: boolean }
): Promise<PredictionBackupPayload> {
  const rows = await fetchPredictionBackupRows();
  const payload: PredictionBackupPayload = {
    saved_at: new Date().toISOString(),
    label,
    row_count: rows.length,
    rows,
  };

  const supabase = getSupabase();

  const { error: tableError } = await supabase
    .from("prediction_snapshots")
    .insert({ label, rows });

  if (tableError) {
    const tableMissing =
      tableError.code === "42P01" ||
      tableError.code === "PGRST205" ||
      tableError.message.includes("prediction_snapshots");
    if (!tableMissing) throw new Error(tableError.message);

    const { error: settingsError } = await supabase.from("settings").upsert({
      key: "predictions_backup_latest",
      value: payload,
    });
    if (settingsError) throw new Error(settingsError.message);
  }

  if (options?.writeLocalFile !== false) {
    const dir = resolve(process.cwd(), "backups");
    mkdirSync(dir, { recursive: true });
    const stamp = payload.saved_at.replace(/[:.]/g, "-");
    writeFileSync(
      resolve(dir, `predictions-${stamp}.json`),
      JSON.stringify(payload, null, 2),
      "utf8"
    );
    writeFileSync(
      resolve(dir, "predictions-latest.json"),
      JSON.stringify(payload, null, 2),
      "utf8"
    );
  }

  return payload;
}
