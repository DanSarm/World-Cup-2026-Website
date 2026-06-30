import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const { getPlayers, getPredictions, getLeaderboardData } = await import("../lib/data");
  const { getSettings } = await import("../lib/auth");
  const { scoreMatchPrediction, scoringConfigFromSettings } = await import("../lib/scoring");
  const { isMatchDecidedForScoring } = await import("../lib/matchLive");
  const { isConfirmedPick } = await import("../lib/pickUtils");
  const { buildPlayerPickSummariesWithConfig } = await import("../lib/playerProfile");

  const bundle = await getLeaderboardData({ skipScoreSync: true });
  const cfg = scoringConfigFromSettings(await getSettings());
  const david = (await getPlayers()).find((p) => /david sarmiento/i.test(p.display_name))!;
  const preds = (await getPredictions()).filter((p) => p.player_id === david.id && isConfirmedPick(p));
  const picks = buildPlayerPickSummariesWithConfig(david.id, bundle.matches, preds, cfg, false);
  const entry = bundle.leaderboard.find((e) => e.playerId === david.id)!;

  console.log("Leaderboard exactScores:", entry.exactScores);
  console.log("Filter exact (exactScore, scored):", picks.filter((p) => p.status === "scored" && p.exactScore).length);
  console.log();

  console.log("--- All scored picks ---");
  for (const p of picks.filter((x) => x.status === "scored").sort((a,b) => a.matchNumber - b.matchNumber)) {
    const scoreMatch = p.actualHome === p.predHome && p.actualAway === p.predAway;
    const m = bundle.matches.find((x) => x.match_number === p.matchNumber)!;
    const pred = preds.find((x) => x.match_id === m.id)!;
    const r = scoreMatchPrediction(m, pred, cfg);
    const flag = [
      p.exactScore ? "EXACT_PILL" : null,
      scoreMatch ? "SCORELINE_MATCH" : null,
      r.exactScore ? "SCORING_EXACT" : null,
      pred.exact_score ? "DB_FLAG" : null,
    ].filter(Boolean).join(", ");
    console.log(
      `M${p.matchNumber} ${p.predHome}-${p.predAway} vs ${p.actualHome}-${p.actualAway} | ${p.stageLabel} | +${p.points} | ${flag || "miss"}`
    );
  }
}

main().catch(console.error);
