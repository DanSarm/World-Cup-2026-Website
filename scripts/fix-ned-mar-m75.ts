/**
 * Fix M75 (NED vs MAR) penalty result, add Daniel Sarmiento's 2-1 pick, fix M74 pens.
 * Usage: npx tsx scripts/fix-ned-mar-m75.ts
 */
import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const { getSupabase } = await import("../lib/supabaseServer");
  const { recalculateAllScores, getMatchesWithTeams, getPlayers, getPredictions } =
    await import("../lib/data");
  const { scoreMatchPrediction, scoringConfigFromSettings } = await import(
    "../lib/scoring"
  );
  const { getSettings } = await import("../lib/auth");
  const { isConfirmedPick } = await import("../lib/pickUtils");

  const supabase = getSupabase();
  const settings = await getSettings();
  const scoringConfig = scoringConfigFromSettings(settings);

  const fixes: Array<{
    matchNumber: number;
    homeScore: number;
    awayScore: number;
    winner: "home" | "away";
    penalties: boolean;
  }> = [
    { matchNumber: 74, homeScore: 1, awayScore: 1, winner: "away", penalties: true },
    { matchNumber: 75, homeScore: 1, awayScore: 1, winner: "away", penalties: true },
  ];

  for (const fix of fixes) {
    const { data: match, error } = await supabase
      .from("matches")
      .select("id, match_number, home_label, away_label, home_team_id, away_team_id")
      .eq("match_number", fix.matchNumber)
      .single();

    if (error || !match) {
      console.error(`M${fix.matchNumber} not found`);
      continue;
    }

    const winnerTeamId =
      fix.winner === "home" ? match.home_team_id : match.away_team_id;

    const { error: upErr } = await supabase
      .from("matches")
      .update({
        home_score: fix.homeScore,
        away_score: fix.awayScore,
        winner_team_id: winnerTeamId,
        decided_by_penalties: fix.penalties,
        status: "final",
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (upErr) {
      console.error(`M${fix.matchNumber} update failed:`, upErr.message);
      continue;
    }

    console.log(
      `M${fix.matchNumber} ${match.home_label} vs ${match.away_label}: ${fix.homeScore}-${fix.awayScore}, winner=${fix.winner}${fix.penalties ? " (pens)" : ""}`
    );
  }

  const daniel = (await getPlayers()).find((p) =>
    /daniel sarmiento/i.test(p.display_name)
  );
  const m75 = (await getMatchesWithTeams()).find((m) => m.match_number === 75);

  if (daniel && m75) {
    const existing = (await getPredictions(daniel.id)).find(
      (p) => p.match_id === m75.id
    );

    if (!existing || !isConfirmedPick(existing)) {
      const row = {
        player_id: daniel.id,
        match_id: m75.id,
        pred_home_score: 2,
        pred_away_score: 1,
        pred_winner_team_id: null,
        pick_confirmed: true,
        submitted_at: "2026-06-29T18:00:00.000Z",
        updated_at: new Date().toISOString(),
      };

      const { error: pickErr } = await supabase
        .from("match_predictions")
        .upsert(row, { onConflict: "player_id,match_id" });

      if (pickErr) {
        console.error("Daniel pick insert failed:", pickErr.message);
      } else {
        console.log(
          `Added Daniel Sarmiento pick for M75: 2-1 ${m75.home_label} (Netherlands)`
        );
      }
    } else {
      console.log(
        `Daniel already has M75 pick: ${existing.pred_home_score}-${existing.pred_away_score}`
      );
    }
  }

  await recalculateAllScores();
  console.log("\nRecalculated all scores.\n");

  const [matches, players, predictions] = await Promise.all([
    getMatchesWithTeams(),
    getPlayers(),
    getPredictions(),
  ]);

  const m75Final = matches.find((m) => m.match_number === 75);
  if (!m75Final) return;

  console.log("=== M75 scorers after fix ===\n");
  const moroccoPickers: string[] = [];

  for (const p of predictions.filter(
    (x) => x.match_id === m75Final.id && isConfirmedPick(x)
  )) {
    const player = players.find((pl) => pl.id === p.player_id);
    const result = scoreMatchPrediction(m75Final, p, scoringConfig);
    const awayWin = p.pred_away_score > p.pred_home_score;
    const tie = p.pred_home_score === p.pred_away_score;
    if (awayWin) moroccoPickers.push(player?.display_name ?? p.player_id);

    if (result.points > 0 || awayWin || tie) {
      console.log(
        `  ${player?.display_name}: ${p.pred_home_score}-${p.pred_away_score}${p.pred_winner_team_id ? ` adv=${p.pred_winner_team_id === m75Final.away_team_id ? "MAR" : "NED"}` : ""} → ${result.points} pts (${result.correctResult ? "correct" : "miss"}${result.exactScore ? ", exact" : ""})`
      );
    }
  }

  console.log(`\nMorocco-winning scorelines (1-2 etc.): ${moroccoPickers.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
