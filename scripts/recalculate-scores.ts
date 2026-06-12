import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });
  const { recalculateAllScores } = await import("../lib/data");
  await recalculateAllScores();
  console.log("Scores recalculated.");
}

main();
