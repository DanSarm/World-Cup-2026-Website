/**
 * EMERGENCY ONLY — restore match scores after accidental wipe.
 * Requires known correct scores. DB trigger blocks clearing scores when picks exist.
 * Usage: npx tsx scripts/restore-cleared-match-scores.ts
 */
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

const RESTORE: Record<number, { home: number; away: number }> = {
  1: { home: 2, away: 0 },
  2: { home: 2, away: 1 },
  3: { home: 1, away: 1 },
  4: { home: 4, away: 1 },
  5: { home: 0, away: 1 },
  6: { home: 2, away: 0 },
  7: { home: 1, away: 1 },
  8: { home: 1, away: 1 },
};

function winnerTeamId(
  homeId: string,
  awayId: string,
  home: number,
  away: number
): string | null {
  if (home > away) return homeId;
  if (away > home) return awayId;
  return null;
}

async function main() {
  const { getSupabase } = await import("../lib/supabaseServer");
  const { recalculateAllScores, getLeaderboardData } = await import("../lib/data");
  const supabase = getSupabase();

  const numbers = Object.keys(RESTORE).map(Number);
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, match_number, home_team_id, away_team_id, home_label, away_label, status")
    .in("match_number", numbers);

  if (error || !matches?.length) {
    console.error("Could not load matches:", error?.message);
    process.exit(1);
  }

  console.log(`Restoring ${matches.length} matches to final...`);
  for (const m of matches.sort((a, b) => a.match_number - b.match_number)) {
    const scores = RESTORE[m.match_number];
    if (!scores) continue;
    const winner = winnerTeamId(
      m.home_team_id,
      m.away_team_id,
      scores.home,
      scores.away
    );
    const { error: upErr } = await supabase
      .from("matches")
      .update({
        home_score: scores.home,
        away_score: scores.away,
        winner_team_id: winner,
        status: "final",
        updated_at: new Date().toISOString(),
      })
      .eq("id", m.id);

    if (upErr) {
      console.error(`  #${m.match_number} FAILED:`, upErr.message);
    } else {
      console.log(
        `  #${m.match_number} final ${m.home_label} ${scores.home}-${scores.away} ${m.away_label}`
      );
    }
  }

  await recalculateAllScores();
  console.log("\nRecalculated all scores.");

  const { leaderboard } = await getLeaderboardData({ skipScoreSync: true });
  console.log("\nLeaderboard top 8:");
  for (const e of leaderboard.slice(0, 8)) {
    console.log(`  ${e.rank}. ${e.displayName}: ${e.totalPoints} pts`);
  }

  const joanne = leaderboard.find((e) =>
    e.displayName.toLowerCase().includes("joanne")
  );
  if (joanne) {
    console.log(`\nJoanne: ${joanne.totalPoints} pts (rank ${joanne.rank})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
