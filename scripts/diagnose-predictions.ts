/**
 * Diagnose prediction damage and find recoverable scores.
 */
import { resolve } from "path";

async function main() {
  try {
    const { config } = await import("dotenv");
    config({ path: resolve(process.cwd(), ".env.local") });
  } catch {
    /* optional */
  }

  const { getSupabase } = await import("../lib/supabaseServer");
  const { getMatchesWithTeams, getPlayers } = await import("../lib/data");
  const { scoreMatchPrediction, scoringConfigFromSettings } = await import("../lib/scoring");
  const { getSettings } = await import("../lib/auth");
  const { isMatchDecidedForScoring } = await import("../lib/matchLive");

  const supabase = getSupabase();
  const [matches, players, settings] = await Promise.all([
    getMatchesWithTeams(),
    getPlayers(),
    getSettings(),
  ]);
  const scoringConfig = scoringConfigFromSettings(settings);

  const { data: predictions, error } = await supabase
    .from("match_predictions")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const preds = predictions ?? [];
  const playerById = new Map(players.map((p) => [p.id, p.display_name]));
  const matchById = new Map(matches.map((m) => [m.id, m]));

  console.log(`Total prediction rows: ${preds.length}`);
  console.log(`Players: ${players.length}`);

  const zeroZero = preds.filter(
    (p) => p.pred_home_score === 0 && p.pred_away_score === 0
  );
  console.log(`0-0 predictions: ${zeroZero.length}`);

  const byConfirmed = { true: 0, false: 0, nullish: 0 };
  for (const p of preds) {
    if (p.pick_confirmed === true) byConfirmed.true++;
    else if (p.pick_confirmed === false) byConfirmed.false++;
    else byConfirmed.nullish++;
  }
  console.log("pick_confirmed:", byConfirmed);

  // Rows where stored points don't match what 0-0 would score now
  const mismatched: typeof preds = [];
  for (const p of preds) {
    const match = matchById.get(p.match_id);
    if (!match || !isMatchDecidedForScoring(match)) continue;
    const scored = scoreMatchPrediction(match, p, scoringConfig);
    const stored = p.points ?? 0;
    if (stored !== scored.points) {
      mismatched.push(p);
    }
  }
  console.log(`\nRows where stored points != current 0-0 score: ${mismatched.length}`);

  // Rows with positive points but 0-0 pick on non-draw finals
  const suspicious = preds.filter((p) => {
    const match = matchById.get(p.match_id);
    if (!match || !isMatchDecidedForScoring(match)) return false;
    if (p.pred_home_score !== 0 || p.pred_away_score !== 0) return false;
    const hs = match.home_score ?? 0;
    const as = match.away_score ?? 0;
    const isDraw = hs === as;
    return (p.points ?? 0) > 0 || p.exact_score || (p.correct_result && !isDraw);
  });
  console.log(`Suspicious 0-0 rows (points/flags vs result): ${suspicious.length}`);

  // Audit log saves
  const { data: audits } = await supabase
    .from("audit_log")
    .select("*")
    .in("action", ["save_match_pick", "override_pick", "import_csv"])
    .order("created_at", { ascending: false })
    .limit(500);

  console.log(`\nRecent pick-related audit entries: ${audits?.length ?? 0}`);
  const savesByPlayer = new Map<string, number>();
  for (const a of audits ?? []) {
    if (a.action === "save_match_pick" && a.actor_player_id) {
      savesByPlayer.set(
        a.actor_player_id,
        (savesByPlayer.get(a.actor_player_id) ?? 0) + 1
      );
    }
  }
  console.log("save_match_pick counts by player:");
  for (const [id, count] of [...savesByPlayer.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${playerById.get(id) ?? id}: ${count}`);
  }

  // Per-player 0-0 count on finalized matches
  console.log("\n0-0 picks on finalized matches by player:");
  for (const player of players.sort((a, b) => a.display_name.localeCompare(b.display_name))) {
    const playerPreds = preds.filter((p) => p.player_id === player.id);
    const finalizedZero = playerPreds.filter((p) => {
      const m = matchById.get(p.match_id);
      return (
        m &&
        isMatchDecidedForScoring(m) &&
        p.pred_home_score === 0 &&
        p.pred_away_score === 0
      );
    }).length;
    const nonZero = playerPreds.filter(
      (p) => p.pred_home_score !== 0 || p.pred_away_score !== 0
    ).length;
    console.log(
      `  ${player.display_name}: ${nonZero} non-zero, ${finalizedZero} zero-zero on finals`
    );
  }

  // Cluster updated_at around backfill
  const updatedCounts = new Map<string, number>();
  for (const p of preds) {
    if (!p.updated_at) continue;
    const day = p.updated_at.slice(0, 16);
    updatedCounts.set(day, (updatedCounts.get(day) ?? 0) + 1);
  }
  console.log("\nupdated_at clusters (minute):");
  for (const [k, v] of [...updatedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${k}: ${v}`);
  }

  // Steve specifically
  const steve = players.find((p) =>
    p.display_name.toLowerCase().includes("steve") &&
    p.display_name.toLowerCase().includes("barrientos")
  );
  if (steve) {
    const stevePreds = preds.filter((p) => p.player_id === steve.id);
    console.log(`\nSteve Barrientos (${steve.id}): ${stevePreds.length} rows`);
    console.log(
      `  confirmed true: ${stevePreds.filter((p) => p.pick_confirmed === true).length}`
    );
    console.log(
      `  confirmed false: ${stevePreds.filter((p) => p.pick_confirmed === false).length}`
    );
    console.log(
      `  non-zero: ${stevePreds.filter((p) => p.pred_home_score !== 0 || p.pred_away_score !== 0).length}`
    );
  }

  if (mismatched.length > 0) {
    console.log("\nSample mismatched rows (stored pts vs rescored):");
    for (const p of mismatched.slice(0, 15)) {
      const match = matchById.get(p.match_id)!;
      const scored = scoreMatchPrediction(match, p, scoringConfig);
      console.log(
        `  ${playerById.get(p.player_id)} match ${match.match_number} pick ${p.pred_home_score}-${p.pred_away_score} stored=${p.points} rescored=${scored.points} exact=${p.exact_score} updated=${p.updated_at}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
