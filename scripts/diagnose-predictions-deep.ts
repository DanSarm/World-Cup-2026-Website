/**
 * Deep dive on damaged predictions.
 */
import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

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

  const { data: predictions } = await supabase.from("match_predictions").select("*");
  const preds = predictions ?? [];
  const playerById = new Map(players.map((p) => [p.id, p.display_name]));
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const damagedTs = "2026-06-12T20:30";
  const batch = preds.filter((p) => p.updated_at?.startsWith(damagedTs));
  console.log(`Batch at ${damagedTs}: ${batch.length} rows`);

  for (const p of batch.sort((a, b) => {
    const ma = matchById.get(a.match_id)?.match_number ?? 0;
    const mb = matchById.get(b.match_id)?.match_number ?? 0;
    return ma - mb || (playerById.get(a.player_id) ?? "").localeCompare(playerById.get(b.player_id) ?? "");
  })) {
    const match = matchById.get(p.match_id);
    if (!match) continue;
    const scored = scoreMatchPrediction(match, p, scoringConfig);
    console.log(
      `${playerById.get(p.player_id)?.padEnd(20)} M${String(match.match_number).padStart(2)} ` +
        `final ${match.home_score}-${match.away_score} pick ${p.pred_home_score}-${p.pred_away_score} ` +
        `stored_pts=${p.points} exact=${p.exact_score} correct=${p.correct_result} rescored=${scored.points}`
    );
  }

  console.log("\n--- Players with zero non-zero picks ---");
  for (const player of players) {
    const pp = preds.filter((x) => x.player_id === player.id);
    const nonZero = pp.filter((x) => x.pred_home_score !== 0 || x.pred_away_score !== 0);
    if (nonZero.length === 0) {
      console.log(`${player.display_name}: ALL ${pp.length} picks are 0-0`);
    }
  }

  console.log("\n--- Match 1 & 2 all picks ---");
  const m1 = matches.find((m) => m.match_number === 1);
  const m2 = matches.find((m) => m.match_number === 2);
  for (const m of [m1, m2]) {
    if (!m) continue;
    console.log(`\nMatch ${m.match_number} final ${m.home_score}-${m.away_score} status=${m.status}`);
    const mp = preds.filter((p) => p.match_id === m.id);
    for (const p of mp.sort((a, b) => (playerById.get(a.player_id) ?? "").localeCompare(playerById.get(b.player_id) ?? ""))) {
      console.log(
        `  ${playerById.get(p.player_id)?.padEnd(20)} ${p.pred_home_score}-${p.pred_away_score} pts=${p.points} exact=${p.exact_score} confirmed=${p.pick_confirmed}`
      );
    }
  }

  // Check if we can infer original picks from exact_score + correct_result + match result
  console.log("\n--- Recoverable from flags (exact=true but pick 0-0) ---");
  for (const p of preds) {
    if (!p.exact_score) continue;
    if (p.pred_home_score !== 0 || p.pred_away_score !== 0) continue;
    const match = matchById.get(p.match_id);
    if (!match || match.home_score == null || match.away_score == null) continue;
    console.log(
      `${playerById.get(p.player_id)} M${match.match_number}: restore to ${match.home_score}-${match.away_score}`
    );
  }

  console.log("\n--- Recoverable from flags (correct_result=true, not exact, pick 0-0) ---");
  for (const p of preds) {
    if (!p.correct_result || p.exact_score) continue;
    if (p.pred_home_score !== 0 || p.pred_away_score !== 0) continue;
    const match = matchById.get(p.match_id);
    if (!match || match.home_score == null || match.away_score == null) continue;
    const hs = match.home_score;
    const as = match.away_score;
    // correct winner but not exact - can't know exact pick, but NOT 0-0 if result wasn't draw
    if (hs !== 0 || as !== 0) {
      console.log(
        `${playerById.get(p.player_id)} M${match.match_number}: had correct winner, final ${hs}-${as}, pick wrongly 0-0 (need manual restore)`
      );
    }
  }
}

main();
