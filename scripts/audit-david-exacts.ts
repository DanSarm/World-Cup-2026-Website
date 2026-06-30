import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const { getPlayers, getPredictions, getMatchesWithTeams, getLeaderboardData } =
    await import("../lib/data");
  const { getSettings } = await import("../lib/auth");
  const { scoreMatchPrediction, scoringConfigFromSettings } = await import(
    "../lib/scoring"
  );
  const { isMatchDecidedForScoring } = await import("../lib/matchLive");
  const { isConfirmedPick, getEffectiveMatchPrediction } = await import(
    "../lib/pickUtils"
  );
  const { buildPlayerPickSummariesWithConfig } = await import(
    "../lib/playerProfile"
  );
  const { computePlayerPickStats } = await import("../lib/playerPickStats");

  const bundle = await getLeaderboardData({ includeLiveScores: true });
  const settings = await getSettings();
  const cfg = scoringConfigFromSettings(settings);
  const david = (await getPlayers()).find((p) =>
    /david sarmiento/i.test(p.display_name)
  );
  if (!david) {
    console.log("David not found");
    return;
  }

  const entry = bundle.leaderboard.find((e) => e.playerId === david.id);
  const matches = bundle.matches;
  const preds = (await getPredictions()).filter(
    (p) => p.player_id === david.id && isConfirmedPick(p)
  );
  const picks = buildPlayerPickSummariesWithConfig(
    david.id,
    matches,
    preds,
    cfg,
    bundle.hasLiveScoring
  );
  const stats = computePlayerPickStats(picks);
  const filterExact = picks.filter(
    (p) => (p.status === "scored" || p.status === "live") && p.exactScore
  );

  console.log("Leaderboard exactScores:", entry?.exactScores);
  console.log("Profile pickStats.exact:", stats.exact);
  console.log("Exact filter count (scored+live):", filterExact.length);
  console.log("profile.exactScores field:", entry?.exactScores);

  let calcExact = 0;
  let storedExact = 0;
  console.log("\nCalc exact matches:");
  for (const p of preds) {
    const m = matches.find((x) => x.id === p.match_id);
    if (!m || !isMatchDecidedForScoring(m)) continue;
    const effective = getEffectiveMatchPrediction(m, p)!;
    const r = scoreMatchPrediction(m, effective, cfg);
    if (p.exact_score) storedExact++;
    if (r.exactScore) {
      calcExact++;
      console.log(
        `  M${m.match_number} pick ${p.pred_home_score}-${p.pred_away_score} actual ${m.home_score}-${m.away_score} status=${m.status} stored_flag=${p.exact_score}`
      );
    }
  }
  console.log("\nCalc total:", calcExact, "stored exact_score flags:", storedExact);

  console.log("\nPicks with exactScore flag in profile summaries:");
  for (const pick of picks.filter((p) => p.exactScore)) {
    console.log(
      `  M${pick.matchNumber} status=${pick.status} pts=${pick.points}`
    );
  }
}

main().catch(console.error);
