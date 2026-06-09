/**
 * Updates matches.kickoff_at with the official FIFA kickoff times (stored UTC).
 * Only touches kickoff_at — no picks, scores, or predictions are modified.
 *
 * Usage: npx tsx scripts/fix-kickoff-times.ts
 */
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { ALL_FIXTURES } from "../lib/fixturesData";

async function main() {
  try {
    const { config } = await import("dotenv");
    config({ path: resolve(process.cwd(), ".env.local") });
  } catch {
    /* dotenv optional */
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, serviceKey);

  let updated = 0;
  let failed = 0;
  for (const f of ALL_FIXTURES) {
    if (!f.kickoff_utc) continue;
    const { error } = await sb
      .from("matches")
      .update({ kickoff_at: f.kickoff_utc })
      .eq("match_number", f.match_number);
    if (error) {
      console.error(`Match ${f.match_number}: ${error.message}`);
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`Updated kickoff times for ${updated} matches (${failed} failures).`);

  const { data: sample } = await sb
    .from("matches")
    .select("match_number, home_label, away_label, kickoff_at")
    .in("match_number", [1, 2, 7, 32, 59, 104])
    .order("match_number");
  console.log("Spot check:");
  for (const m of sample ?? []) {
    const et = new Date(m.kickoff_at).toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    });
    console.log(`  #${m.match_number} ${m.home_label} v ${m.away_label} → ${et} ET`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
