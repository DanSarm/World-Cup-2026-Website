/**
 * Save a full snapshot of all match_predictions to:
 * - prediction_snapshots table (or settings fallback)
 * - backups/predictions-latest.json (local, gitignored)
 *
 * Usage: npm run backup:predictions
 *        npm run backup:predictions -- --label after-manual-restore
 */
import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const labelArg = process.argv.find((a) => a.startsWith("--label="));
  const label =
    labelArg?.slice("--label=".length) ??
    `manual-${new Date().toISOString().slice(0, 10)}`;

  const { savePredictionSnapshot } = await import("../lib/predictionBackup");
  const payload = await savePredictionSnapshot(label);

  console.log(
    `Saved ${payload.row_count} predictions (${label}) at ${payload.saved_at}`
  );
  console.log("Local copy: backups/predictions-latest.json");
  console.log(
    "Cloud copy: prediction_snapshots table (run supabase/migrations/add_prediction_snapshots.sql if missing)"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
