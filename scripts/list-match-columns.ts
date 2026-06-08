import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf8");
function getEnv(key: string): string {
  const line = envText.split("\n").find((l) => l.startsWith(key + "="));
  if (!line) return "";
  let val = line.slice(key.length + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  return val;
}

async function main() {
  const sb = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

  const { data, error } = await sb.from("matches").select("*").limit(1);
  if (error) {
    console.log("matches query error:", error.message, error.code);
  } else if (data?.[0]) {
    console.log("matches columns:", Object.keys(data[0]).sort().join(", "));
  } else {
    console.log("matches table empty or no rows");
    const { error: e2 } = await sb.from("matches").select("id, match_number").limit(1);
    console.log("minimal select:", e2?.message ?? "ok");
  }

  const { error: snapErr } = await sb.from("odds_snapshots").select("id").limit(1);
  console.log("odds_snapshots:", snapErr ? snapErr.message : "exists");
}

main().catch(console.error);
