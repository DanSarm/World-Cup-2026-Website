/**
 * Remove ghost 0-0 default picks on already-decided matches.
 * Real 0-0 picks are only possible on not-yet-played games.
 *
 * Marks pick_confirmed=false and zeros stored points — does not touch match scores.
 * Usage: npx tsx scripts/unmark-ghost-zero-zero-picks.ts
 */
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { getSupabase } = await import("../lib/supabaseServer");
  const { getMatchesWithTeams, getPlayers, recalculateAllScores, getLeaderboardData } =
    await import("../lib/data");
  const { isMatchDecidedForScoring } = await import("../lib/matchLive");

  const supabase = getSupabase();
  const [matches, players] = await Promise.all([
    getMatchesWithTeams(),
    getPlayers(),
  ]);
  const playerById = new Map(players.map((p) => [p.id, p.display_name]));
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const decidedIds = new Set(
    matches.filter(isMatchDecidedForScoring).map((m) => m.id)
  );

  const { data: preds, error } = await supabase
    .from("match_predictions")
    .select("id, player_id, match_id, pred_home_score, pred_away_score, points, pick_confirmed");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const ghosts = (preds ?? []).filter((p) => {
    if (!decidedIds.has(p.match_id)) return false;
    if (p.pred_home_score !== 0 || p.pred_away_score !== 0) return false;
    return p.pick_confirmed !== false;
  });

  if (!ghosts.length) {
    console.log("No ghost 0-0 picks on decided matches.");
    return;
  }

  console.log(`Unmarking ${ghosts.length} ghost 0-0 picks:`);
  for (const p of ghosts) {
    const m = matchById.get(p.match_id)!;
    console.log(
      `  ${playerById.get(p.player_id)} M${m.match_number} (was ${p.points ?? 0} pts)`
    );
    const { error: upErr } = await supabase
      .from("match_predictions")
      .update({
        pick_confirmed: false,
        points: 0,
        exact_score: false,
        correct_result: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (upErr) {
      console.error(`  FAILED ${p.id}:`, upErr.message);
    }
  }

  await recalculateAllScores();
  console.log("\nRecalculated scores.");

  const { leaderboard } = await getLeaderboardData({ skipScoreSync: true });
  console.log("\nLeaderboard top 8:");
  for (const e of leaderboard.slice(0, 8)) {
    console.log(`  ${e.rank}. ${e.displayName}: ${e.totalPoints} pts`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
