import { getSupabase } from "@/lib/supabaseServer";

export async function validateOddsSchema(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("matches")
    .select("odds_status, home_implied_probability, home_win_bonus")
    .limit(1);

  if (error?.code === "42703") {
    return {
      ok: false,
      error:
        "Database is missing odds columns. Open Supabase SQL Editor and run the full contents of supabase/migrations/upgrade_odds_and_bonuses.sql, then sync again.",
    };
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  const { error: snapErr } = await supabase
    .from("odds_snapshots")
    .select("id")
    .limit(1);

  if (snapErr?.code === "42P01") {
    return {
      ok: false,
      error:
        "Database is missing odds_snapshots table. Run supabase/migrations/upgrade_odds_and_bonuses.sql in Supabase SQL Editor.",
    };
  }

  return { ok: true };
}
