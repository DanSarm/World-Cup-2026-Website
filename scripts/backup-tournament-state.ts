/**
 * Save predictions + match results to cloud snapshot and local JSON.
 *
 * Usage: npm run backup:tournament
 *        npm run backup:tournament -- --label=post-restore-2026-06-14
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const labelArg = process.argv.find((a) => a.startsWith("--label="));
  const label =
    labelArg?.slice("--label=".length) ??
    `tournament-${new Date().toISOString().slice(0, 10)}`;

  const { savePredictionSnapshot } = await import("../lib/predictionBackup");
  const { saveMatchResultSnapshot } = await import("../lib/matchResultBackup");

  const [predictions, matchResults] = await Promise.all([
    savePredictionSnapshot(`${label}-predictions`, { writeLocalFile: false }),
    saveMatchResultSnapshot(label),
  ]);

  const payload = {
    saved_at: new Date().toISOString(),
    label,
    predictions,
    matchResults,
  };

  const dir = resolve(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = payload.saved_at.replace(/[:.]/g, "-");
  writeFileSync(
    resolve(dir, `tournament-${stamp}.json`),
    JSON.stringify(payload, null, 2),
    "utf8"
  );
  writeFileSync(
    resolve(dir, "tournament-latest.json"),
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  console.log(`Saved tournament backup (${label})`);
  console.log(`  Predictions: ${predictions.row_count} rows`);
  console.log(`  Match results: ${matchResults.row_count} rows with scores`);
  console.log("  Local: backups/tournament-latest.json");
  console.log("  Cloud: prediction_snapshots + match_result_snapshots tables");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
