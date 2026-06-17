/**
 * Update Austria vs Jordan (M20) to correct final score 3-1. Predictions untouched.
 * Usage: npx tsx scripts/fix-match-score.ts --match=20 --home=3 --away=1
 */
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main() {
  const matchNumber = Number(arg("match"));
  const homeScore = Number(arg("home"));
  const awayScore = Number(arg("away"));

  if (!matchNumber || Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
    console.error("Usage: --match=N --home=H --away=A");
    process.exit(1);
  }

  const { getSupabase } = await import("../lib/supabaseServer");
  const { recalculateAllScores, getLeaderboardData } = await import("../lib/data");
  const supabase = getSupabase();

  const { data: match, error } = await supabase
    .from("matches")
    .select("id, match_number, home_label, away_label, home_team_id, away_team_id, home_score, away_score, status")
    .eq("match_number", matchNumber)
    .single();

  if (error || !match) {
    console.error("Match not found:", error?.message);
    process.exit(1);
  }

  let winnerTeamId: string | null = null;
  if (homeScore > awayScore) winnerTeamId = match.home_team_id;
  else if (awayScore > homeScore) winnerTeamId = match.away_team_id;

  console.log(
    `Updating M${match.match_number} ${match.home_label} vs ${match.away_label}: ${match.home_score}-${match.away_score} -> ${homeScore}-${awayScore}`
  );

  const { error: upErr } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      winner_team_id: winnerTeamId,
      status: "final",
      updated_at: new Date().toISOString(),
    })
    .eq("id", match.id);

  if (upErr) {
    console.error("Update failed:", upErr.message);
    process.exit(1);
  }

  await recalculateAllScores();
  console.log("Recalculated prediction points from new final score.");

  const { leaderboard } = await getLeaderboardData({ skipScoreSync: true });
  console.log("\nLeaderboard top 5:");
  for (const e of leaderboard.slice(0, 5)) {
    console.log(`  ${e.rank}. ${e.displayName}: ${e.totalPoints} pts`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
