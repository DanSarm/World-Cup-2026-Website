/**
 * Merge real predictions from a Supabase backup database into production.
 *
 * Use after restoring a Supabase backup to a temporary project (or branch)
 * from BEFORE 2026-06-12 20:30 UTC — when the bad 0-0 backfill ran.
 *
 * Setup:
 *   1. Supabase Dashboard → Database → Backups → restore/branch before the backfill
 *   2. Add to .env.local:
 *        SUPABASE_DB_PASSWORD=your-production-db-password
 *        BACKUP_DB_PASSWORD=your-backup-project-db-password
 *        BACKUP_SUPABASE_URL=https://YOUR-BACKUP-PROJECT.supabase.co  (optional; defaults to same ref with BACKUP_DB_PASSWORD on same host won't work — use backup project URL)
 *
 * Usage:
 *   npm run merge:predictions-from-backup
 */
import { resolve } from "path";

const DAMAGE_START = "2026-06-12T20:30:00.000Z";

type BackupRow = {
  player_id: string;
  match_id: string;
  pred_home_score: number;
  pred_away_score: number;
  pred_winner_team_id: string | null;
  pick_confirmed: boolean | null;
  submitted_at: string | null;
};

function postgresClient(
  url: string,
  password: string,
  postgresImport: typeof import("postgres")["default"]
) {
  const ref = new URL(url).hostname.split(".")[0];
  return postgresImport({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: "postgres",
    username: "postgres",
    password,
    ssl: "require",
    max: 1,
  });
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const prodUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const backupUrl = process.env.BACKUP_SUPABASE_URL ?? prodUrl;
  const prodPassword = process.env.SUPABASE_DB_PASSWORD;
  const backupPassword =
    process.env.BACKUP_DB_PASSWORD ?? process.env.SUPABASE_DB_PASSWORD;

  if (!prodUrl || !prodPassword || !backupPassword) {
    console.error(`
Missing database credentials.

Add to .env.local:
  SUPABASE_DB_PASSWORD=...
  BACKUP_DB_PASSWORD=...        (from restored backup project)
  BACKUP_SUPABASE_URL=https://xxx.supabase.co   (restored backup project URL)

Or restore manually in Supabase SQL Editor using supabase/migrations/restore_predictions_from_backup.sql
`);
    process.exit(1);
  }

  const { default: postgres } = await import("postgres");
  const prod = postgresClient(prodUrl, prodPassword, postgres);
  const backup = postgresClient(backupUrl, backupPassword, postgres);

  try {
    const backupRows = await backup<BackupRow[]>`
      SELECT player_id, match_id, pred_home_score, pred_away_score,
             pred_winner_team_id, pick_confirmed, submitted_at
      FROM match_predictions
    `;

    console.log(`Backup rows: ${backupRows.length}`);

    const prodRows = await prod<
      BackupRow & { id: string; updated_at: string }
    >`
      SELECT id, player_id, match_id, pred_home_score, pred_away_score,
             pred_winner_team_id, pick_confirmed, submitted_at, updated_at
      FROM match_predictions
    `;

    const backupByKey = new Map(
      backupRows.map((r) => [`${r.player_id}:${r.match_id}`, r])
    );

    let merged = 0;
    let skipped = 0;

    for (const row of prodRows) {
      const key = `${row.player_id}:${row.match_id}`;
      const saved = backupByKey.get(key);
      if (!saved) {
        skipped++;
        continue;
      }

      const sameScores =
        row.pred_home_score === saved.pred_home_score &&
        row.pred_away_score === saved.pred_away_score;
      if (sameScores) {
        skipped++;
        continue;
      }

      const damaged =
        row.updated_at >= DAMAGE_START ||
        (row.pred_home_score === 0 &&
          row.pred_away_score === 0 &&
          saved.pred_home_score + saved.pred_away_score > 0);

      if (!damaged) {
        skipped++;
        continue;
      }

      await prod`
        UPDATE match_predictions
        SET pred_home_score = ${saved.pred_home_score},
            pred_away_score = ${saved.pred_away_score},
            pred_winner_team_id = ${saved.pred_winner_team_id},
            pick_confirmed = COALESCE(${saved.pick_confirmed}, true),
            updated_at = NOW()
        WHERE id = ${row.id}::uuid
      `;

      merged++;
      const { data: names } = await prod`
        SELECT p.display_name, m.match_number
        FROM players p, matches m
        WHERE p.id = ${row.player_id}::uuid AND m.id = ${row.match_id}::uuid
      `;
      const info = names[0] as { display_name: string; match_number: number };
      console.log(
        `Restored ${info.display_name} M${info.match_number}: ${saved.pred_home_score}-${saved.pred_away_score}`
      );
    }

    console.log(`\nMerged ${merged} rows, skipped ${skipped}.`);
    console.log("Run Admin → Recalculate scores (or npm run restore:predictions recalc path).");
  } finally {
    await prod.end();
    await backup.end();
  }

  const { recalculateAllScores } = await import("../lib/data");
  await recalculateAllScores();
  console.log("Scores recalculated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
