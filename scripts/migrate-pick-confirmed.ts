/**
 * Adds pick_confirmed to match_predictions without deleting any rows.
 *
 * Usage:
 *   1. Supabase → Project Settings → Database → copy the database password
 *   2. Add to .env.local:  SUPABASE_DB_PASSWORD=your-password
 *   3. npm run migrate:pick-confirmed
 *
 * Or paste supabase/migrations/add_pick_confirmed.sql into Supabase SQL Editor.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const { config } = await import("dotenv");
    config({ path: envPath });
  } catch {
    /* dotenv optional */
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, serviceKey);
  const { count: before, error: beforeErr } = await sb
    .from("match_predictions")
    .select("*", { count: "exact", head: true });

  if (beforeErr) {
    console.error("Could not count predictions:", beforeErr.message);
    process.exit(1);
  }

  console.log(`Predictions before migration: ${before ?? 0}`);

  if (!dbPassword) {
    console.log(`
No SUPABASE_DB_PASSWORD in .env.local — run this SQL in Supabase → SQL Editor:

${readFileSync(resolve(process.cwd(), "supabase/migrations/add_pick_confirmed.sql"), "utf8")}
`);
    process.exit(0);
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
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/add_pick_confirmed.sql"),
      "utf8"
    );

    await sql.unsafe(migration);

    const [{ count: after }] = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM match_predictions
    `;

    console.log(`Predictions after migration: ${after}`);
    if (String(before) !== after) {
      console.error("ERROR: prediction count changed — investigate before continuing");
      process.exit(1);
    }

    console.log("Migration complete. All existing picks kept; pick_confirmed column added.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
