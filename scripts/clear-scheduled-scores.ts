/**
 * Clear scores wrongly written onto still-scheduled matches (ESPN sync bug).
 * Usage: npx tsx scripts/clear-scheduled-scores.ts
 */
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { getSupabase } = await import("../lib/supabaseServer");
  const supabase = getSupabase();

  const { data: bad, error: fetchErr } = await supabase
    .from("matches")
    .select("id, match_number, home_label, away_label, status, home_score, away_score")
    .eq("status", "scheduled")
    .not("home_score", "is", null);

  if (fetchErr) {
    console.error(fetchErr.message);
    process.exit(1);
  }

  if (!bad?.length) {
    console.log("No scheduled matches with scores — nothing to clear.");
    return;
  }

  console.log(`Clearing scores on ${bad.length} scheduled matches:`);
  for (const m of bad) {
    console.log(
      `  #${m.match_number} ${m.home_label} ${m.home_score}-${m.away_score} ${m.away_label}`
    );
  }

  const ids = bad.map((m) => m.id);
  const { error: updateErr } = await supabase
    .from("matches")
    .update({
      home_score: null,
      away_score: null,
      winner_team_id: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (updateErr) {
    console.error("Update failed:", updateErr.message);
    process.exit(1);
  }

  const { recalculateAllScores } = await import("../lib/data");
  await recalculateAllScores();
  console.log("Done — scores cleared and leaderboard recalculated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
