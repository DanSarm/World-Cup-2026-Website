import { readFileSync } from "fs";
import { join } from "path";

try {
  const envFile = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // optional
}

async function main() {
  const { getSupabase } = await import("../lib/supabaseServer");
  const { reconcileRecentFinalScores } = await import("../lib/scores/sync");
  const supabase = getSupabase();

  const { data: before } = await supabase
    .from("matches")
    .select("match_number, home_score, away_score, status")
    .eq("match_number", 6)
    .single();
  console.log("Before:", before);

  const result = await reconcileRecentFinalScores();
  console.log("Reconcile:", result);

  if (result.needsRecalc) {
    const { recalculateAllScores } = await import("../lib/data");
    await recalculateAllScores();
    console.log("Recalculated all prediction points.");
  }

  const { data: after } = await supabase
    .from("matches")
    .select("match_number, home_score, away_score, status")
    .eq("match_number", 6)
    .single();
  console.log("After:", after);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
