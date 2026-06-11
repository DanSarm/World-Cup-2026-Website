/**
 * Allows matches.status = 'live' (needed for live score sync).
 *
 * Usage:
 *   1. Supabase → Project Settings → Database → copy the database password
 *   2. Add to .env.local:  SUPABASE_DB_PASSWORD=your-password
 *   3. npx tsx scripts/apply-live-status-migration.ts
 *
 * Or paste supabase/migrations/add_live_match_status.sql into Supabase SQL Editor.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const { config } = await import("dotenv");
    config({ path: envPath });
  } catch {
    /* dotenv optional */
  }

  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/add_live_match_status.sql"),
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
    console.log("Applied add_live_match_status migration.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
