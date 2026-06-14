/**
 * Creates push_subscriptions + pick_reminder_sent tables.
 *
 * Usage:
 *   1. Supabase → Project Settings → Database → copy the database password
 *   2. Add to .env.local:  SUPABASE_DB_PASSWORD=your-password
 *   3. npx tsx scripts/apply-push-notifications-migration.ts
 *
 * Or paste supabase/migrations/add_push_notifications.sql into Supabase SQL Editor.
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

  const migration = [
    readFileSync(
      resolve(process.cwd(), "supabase/migrations/add_push_notifications.sql"),
      "utf8"
    ),
    readFileSync(
      resolve(process.cwd(), "supabase/migrations/add_notifications_sent.sql"),
      "utf8"
    ),
  ].join("\n\n");

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
    console.error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }

  const host = new URL(url).hostname.replace(".supabase.co", "");
  const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${host}.supabase.co:5432/postgres`;

  const postgres = (await import("postgres")).default;
  const sql = postgres(connectionString, { ssl: "require", max: 1 });

  try {
    await sql.unsafe(migration);
    console.log("Push notifications migration applied successfully.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
