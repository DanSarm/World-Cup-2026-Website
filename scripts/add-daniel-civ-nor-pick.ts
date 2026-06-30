import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const { getSupabase } = await import("../lib/supabaseServer");
  const {
    recalculateAllScores,
    getMatchesWithTeams,
    getPlayers,
    getPredictions,
  } = await import("../lib/data");
  const { isConfirmedPick } = await import("../lib/pickUtils");

  const supabase = getSupabase();
  const matches = await getMatchesWithTeams();
  const match = matches.find(
    (m) =>
      /ivory|côte|ivoire|civ/i.test(`${m.home_label}${m.away_label}`) &&
      /norway/i.test(`${m.home_label}${m.away_label}`)
  );

  if (!match) {
    console.error("Ivory Coast vs Norway match not found");
    process.exit(1);
  }

  const daniel = (await getPlayers()).find((p) =>
    /daniel sarmiento/i.test(p.display_name)
  );
  if (!daniel) {
    console.error("Daniel Sarmiento not found");
    process.exit(1);
  }

  console.log(
    `M${match.match_number} ${match.home_label} vs ${match.away_label} (${match.status} ${match.home_score}-${match.away_score})`
  );

  const isIvoryHome = /ivory|côte|ivoire|civ/i.test(match.home_label);
  const predHome = isIvoryHome ? 2 : 1;
  const predAway = isIvoryHome ? 1 : 2;
  const predWinnerTeamId = isIvoryHome
    ? match.home_team_id
    : match.away_team_id;

  const existing = (await getPredictions(daniel.id)).find(
    (p) => p.match_id === match.id
  );

  const row = {
    player_id: daniel.id,
    match_id: match.id,
    pred_home_score: predHome,
    pred_away_score: predAway,
    pred_winner_team_id: predWinnerTeamId,
    pick_confirmed: true,
    submitted_at: existing?.submitted_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("match_predictions")
    .upsert(row, { onConflict: "player_id,match_id" });

  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }

  if (existing && isConfirmedPick(existing)) {
    console.log(
      `Updated Daniel's pick: was ${existing.pred_home_score}-${existing.pred_away_score} → ${predHome}-${predAway} (Ivory Coast win)`
    );
  } else {
    console.log(
      `Added Daniel's pick: ${predHome}-${predAway} Ivory Coast to win`
    );
  }

  await recalculateAllScores();
  console.log("Recalculated all scores.");

  const updated = (await getPredictions(daniel.id)).find(
    (p) => p.match_id === match.id
  );
  console.log(
    `Stored: ${updated?.pred_home_score}-${updated?.pred_away_score} pts=${updated?.points} exact=${updated?.exact_score}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
