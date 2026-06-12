/**
 * Restore predictions wiped by the bad 0-0 backfill (2026-06-12T20:30 UTC batch).
 *
 * Recovery rules (from flags left before rescore):
 * - exact_score=true  → restore to the match final score
 * - correct_result=true, not exact, points>0 → restore minimal correct winner score
 * - otherwise leave as-is (true missing pick or already wrong)
 *
 * Usage: npm run restore:predictions
 */
import { resolve } from "path";

function inferMinimalCorrectPick(
  homeScore: number,
  awayScore: number
): { predHome: number; predAway: number } {
  if (homeScore > awayScore) return { predHome: 1, predAway: 0 };
  if (awayScore > homeScore) return { predHome: 0, predAway: 1 };
  return { predHome: 0, predAway: 0 };
}

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const { getSupabase } = await import("../lib/supabaseServer");
  const { getMatchesWithTeams, getPlayers, recalculateAllScores } = await import("../lib/data");

  const supabase = getSupabase();
  const [matches, players] = await Promise.all([
    getMatchesWithTeams(),
    getPlayers(),
  ]);
  const playerById = new Map(players.map((p) => [p.id, p.display_name]));
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const { data: predictions, error } = await supabase
    .from("match_predictions")
    .select("*");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const damagedPrefix = "2026-06-12T20:30";
  const batch = (predictions ?? []).filter((p) =>
    p.updated_at?.startsWith(damagedPrefix)
  );

  console.log(`Found ${batch.length} rows from damaged batch`);

  let restored = 0;
  let skipped = 0;

  for (const row of batch) {
    const match = matchById.get(row.match_id);
    if (!match || match.home_score == null || match.away_score == null) {
      skipped++;
      continue;
    }

    const hs = match.home_score;
    const as = match.away_score;
    const isZeroPick = row.pred_home_score === 0 && row.pred_away_score === 0;
    if (!isZeroPick) {
      skipped++;
      continue;
    }

    let predHome: number | null = null;
    let predAway: number | null = null;

    if (row.exact_score) {
      predHome = hs;
      predAway = as;
    } else if (row.correct_result && (row.points ?? 0) > 0) {
      const minimal = inferMinimalCorrectPick(hs, as);
      predHome = minimal.predHome;
      predAway = minimal.predAway;
    }

    if (predHome == null || predAway == null) {
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("match_predictions")
      .update({
        pred_home_score: predHome,
        pred_away_score: predAway,
        pick_confirmed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      console.error(
        `Failed ${playerById.get(row.player_id)} M${match.match_number}:`,
        updateError.message
      );
      continue;
    }

    restored++;
    console.log(
      `Restored ${playerById.get(row.player_id)} M${match.match_number}: ${predHome}-${predAway}` +
        (row.exact_score ? " (exact)" : " (correct winner)")
    );
  }

  console.log(`\nRestored ${restored}, skipped ${skipped}`);
  console.log("Recalculating scores...");
  await recalculateAllScores();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
