/**
 * Verify getPredictions() returns every row and each player's profile picks
 * match their leaderboard match points.
 */
import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const { getPlayers, getPredictions, getLeaderboardData } = await import(
    "../lib/data"
  );
  const { getSupabase } = await import("../lib/supabaseServer");
  const { getSettings } = await import("../lib/auth");
  const { scoringConfigFromSettings } = await import("../lib/scoring");
  const {
    buildPlayerPickSummariesWithConfig,
    syncPickScoringFlags,
  } = await import("../lib/playerProfile");
  const { isConfirmedPick } = await import("../lib/pickUtils");

  const supabase = getSupabase();
  const { count: dbCount } = await supabase
    .from("match_predictions")
    .select("*", { count: "exact", head: true });

  const fetched = await getPredictions();
  console.log("=== Prediction fetch ===");
  console.log(`DB rows: ${dbCount ?? "?"}`);
  console.log(`getPredictions(): ${fetched.length}`);
  if (dbCount != null && fetched.length !== dbCount) {
    console.error(`✗ Missing ${dbCount - fetched.length} prediction(s) from fetch`);
    process.exit(1);
  }
  console.log("✓ Full prediction set loaded\n");

  const bundle = await getLeaderboardData({ skipScoreSync: true });
  const cfg = scoringConfigFromSettings(await getSettings());
  const players = await getPlayers();
  let issues = 0;

  console.log("=== Per-player profile vs leaderboard ===\n");

  for (const player of players) {
    const entry = bundle.leaderboard.find((e) => e.playerId === player.id);
    if (!entry) continue;

    const preds = fetched.filter(
      (p) => p.player_id === player.id && isConfirmedPick(p)
    );
    const picks = buildPlayerPickSummariesWithConfig(
      player.id,
      bundle.matches,
      preds,
      cfg,
      false
    );
    syncPickScoringFlags(picks, bundle.matches, preds, cfg);

    const scored = picks.filter((p) => p.status === "scored");
    const exacts = scored.filter((p) => p.exactScore);
    const pickMatchPts = scored.reduce((s, p) => s + p.points, 0);

    const problems: string[] = [];
    if (exacts.length !== entry.exactScores) {
      problems.push(
        `exacts profile=${exacts.length} lb=${entry.exactScores}`
      );
    }
    if (pickMatchPts !== entry.matchPoints) {
      problems.push(
        `match pts profile=${pickMatchPts} lb=${entry.matchPoints}`
      );
    }

    if (problems.length) {
      issues++;
      console.log(`${player.display_name}:`);
      for (const p of problems) console.log(`  ${p}`);
    }
  }

  if (!issues) {
    console.log("✓ All players: exact counts and match points align");
  } else {
    console.log(`\n✗ ${issues} player(s) with mismatches`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
