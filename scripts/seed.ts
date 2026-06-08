import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { ensureMatchesSeeded } from "../lib/matchesDb";

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
  // .env.local optional when vars already set
}

const url =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error(
    "Set SUPABASE_SERVICE_ROLE_KEY (and URL) in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log("Seeding matches...");
  await ensureMatchesSeeded();
  const { count } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });
  console.log(`Done! ${count} matches in database.`);
}

main().catch(console.error);
