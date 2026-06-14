import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getSupabase } from "./supabaseServer";

export type MatchResultBackupRow = {
  match_id: string;
  match_number: number;
  status: string;
  home_label: string;
  away_label: string;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
  kickoff_at: string | null;
};

export type MatchResultBackupPayload = {
  saved_at: string;
  label: string;
  row_count: number;
  rows: MatchResultBackupRow[];
};

export async function fetchMatchResultBackupRows(): Promise<MatchResultBackupRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, match_number, status, home_label, away_label, home_score, away_score, winner_team_id, kickoff_at"
    )
    .not("home_score", "is", null)
    .order("match_number");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    match_id: row.id,
    match_number: row.match_number,
    status: row.status,
    home_label: row.home_label,
    away_label: row.away_label,
    home_score: row.home_score,
    away_score: row.away_score,
    winner_team_id: row.winner_team_id,
    kickoff_at: row.kickoff_at,
  }));
}

export async function saveMatchResultSnapshot(
  label: string,
  options?: { writeLocalFile?: boolean }
): Promise<MatchResultBackupPayload> {
  const rows = await fetchMatchResultBackupRows();
  const payload: MatchResultBackupPayload = {
    saved_at: new Date().toISOString(),
    label,
    row_count: rows.length,
    rows,
  };

  const supabase = getSupabase();
  const { error: tableError } = await supabase
    .from("match_result_snapshots")
    .insert({ label, rows });

  if (tableError) {
    const tableMissing =
      tableError.code === "42P01" ||
      tableError.code === "PGRST205" ||
      tableError.message.includes("match_result_snapshots");
    if (!tableMissing) throw new Error(tableError.message);

    const { error: settingsError } = await supabase.from("settings").upsert({
      key: "match_results_backup_latest",
      value: payload,
    });
    if (settingsError) throw new Error(settingsError.message);
  }

  if (options?.writeLocalFile !== false) {
    const dir = resolve(process.cwd(), "backups");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, "match-results-latest.json"),
      JSON.stringify(payload, null, 2),
      "utf8"
    );
  }

  return payload;
}
