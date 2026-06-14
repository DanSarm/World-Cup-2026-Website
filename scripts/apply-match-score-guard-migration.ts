/**
 * DB trigger: block clearing match scores when picks exist; block final → scheduled.
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD=... npx tsx scripts/apply-match-score-guard-migration.ts
 *
 * Or paste supabase/migrations/add_match_score_guard.sql into Supabase SQL Editor.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/add_match_score_guard.sql"),
    "utf8"
  );

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!dbPassword) {
    console.log(`
No SUPABASE_DB_PASSWORD in .env.local — run this SQL in Supabase → SQL Editor:

${migration}
`);
    process.exit(0);
  }

  if (!url) {
    console.error("Missing SUPABASE_URL in .env.local");
    process.exit(1);
  }

  const ref = new URL(url).hostname.split(".")[0];
  const { default: postgres } = await import("postgres");
  const sql = postgres({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: "postgres",
    username: "postgres",
    password: dbPassword,
    ssl: "require",
    max: 1,
  });

  try {
    await sql.unsafe(migration);
    console.log("Applied add_match_score_guard migration (trigger + snapshots table).");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
