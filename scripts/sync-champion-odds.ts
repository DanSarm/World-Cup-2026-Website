/**
 * Refresh champion win probabilities (Polymarket fallback when Odds API quota is out).
 *
 * Usage: npm run sync:champion-odds
 */
import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const { getTeams } = await import("../lib/data");
  const { syncChampionOdds } = await import("../lib/odds/championOdds");

  const teams = await getTeams();
  const result = await syncChampionOdds(teams);

  console.log(
    `Synced ${result.teamCount} champion odds from ${result.source}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
