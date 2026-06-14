import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const { getPlayers, getMatchesWithTeams, getPredictions } = await import(
    "../lib/data"
  );
  const { getSettings } = await import("../lib/auth");
  const { scoringConfigFromSettings } = await import("../lib/scoringConfig");
  const { buildPlayerRecentForm } = await import("../lib/recentPickForm");
  const { isConfirmedPick } = await import("../lib/pickUtils");

  const [players, matches, predictions, settings] = await Promise.all([
    getPlayers(),
    getMatchesWithTeams(),
    getPredictions(),
    getSettings(),
  ]);
  const scoringConfig = scoringConfigFromSettings(settings);
  const finalCount = matches.filter((m) => m.status === "final").length;

  const sonny = players.find((p) => /sonny/i.test(p.display_name));
  if (!sonny) return console.error("no sonny");

  const sonnyPreds = predictions.filter(
    (p) => p.player_id === sonny.id && isConfirmedPick(p)
  );
  const form = buildPlayerRecentForm(
    sonny.id,
    matches,
    predictions,
    scoringConfig
  );
  const filled = form.filter((s) => s != null).length;

  console.log("Final matches:", finalCount);
  console.log("Sonny confirmed picks:", sonnyPreds.length);
  console.log("Sonny form filled:", filled, form);

  for (const p of players) {
    const f = buildPlayerRecentForm(p.id, matches, predictions, scoringConfig);
    const n = f.filter((s) => s != null).length;
    if (n !== finalCount) {
      console.log("MISMATCH", p.display_name, n, "vs", finalCount);
    }
  }
}

main().catch(console.error);
