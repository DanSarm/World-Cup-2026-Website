/**
 * Backfill confirmed 0-0 picks for locked matches with no saved pick.
 *
 * Usage:
 *   npm run backfill:default-picks
 *
 * Or paste supabase/migrations/backfill_default_zero_zero_picks.sql
 * into Supabase → SQL Editor.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const { config } = await import("dotenv");
    config({ path: envPath });
  } catch {
    /* dotenv optional */
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    console.log(`
Run this SQL in Supabase → SQL Editor instead:

${readFileSync(
  resolve(process.cwd(), "supabase/migrations/backfill_default_zero_zero_picks.sql"),
  "utf8"
)}
`);
    process.exit(1);
  }

  const {
    getMatchesWithTeams,
    getPlayers,
    getPredictions,
    recalculateAllScores,
  } = await import("../lib/data");

  const [matches, players, predictions] = await Promise.all([
    getMatchesWithTeams(),
    getPlayers(),
    getPredictions(),
  ]);

  const { listMissingDefaultPickRows, ensureDefaultPredictionsForLockedMatches } =
    await import("../lib/defaultPredictions");

  const missingBefore = listMissingDefaultPickRows(matches, players, predictions);
  console.log(`Missing default picks to backfill: ${missingBefore.length}`);

  await ensureDefaultPredictionsForLockedMatches(matches, players, predictions);

  const refreshed = await getPredictions();
  const missingAfter = listMissingDefaultPickRows(matches, players, refreshed);
  console.log(`Remaining missing default picks: ${missingAfter.length}`);

  console.log("Recalculating stored match scores...");
  await recalculateAllScores();
  console.log("Backfill complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
