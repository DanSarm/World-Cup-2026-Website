import { getSupabase } from "./supabaseServer";
import { ensureTeamsSeeded } from "./teamsDb";
import { ALL_FIXTURES } from "./fixturesData";

export async function ensureMatchesSeeded(): Promise<void> {
  const supabase = getSupabase();
  await ensureTeamsSeeded();

  const { count } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });

  if (count && count >= ALL_FIXTURES.length) return;

  const { data: teams } = await supabase.from("teams").select("id, fifa_code");
  const teamMap = new Map(
    (teams ?? []).map((t) => [t.fifa_code, t.id as string])
  );

  for (const f of ALL_FIXTURES) {
    // Official kickoff times (stored UTC, ET schedule)
    const kickoffAt =
      f.kickoff_utc ?? (f.date ? `${f.date}T18:00:00.000Z` : null);

    await supabase.from("matches").upsert(
      {
        match_number: f.match_number,
        stage: f.stage,
        group_letter: f.group_letter ?? null,
        kickoff_at: kickoffAt,
        venue: f.venue,
        home_team_id: f.home_code ? teamMap.get(f.home_code) ?? null : null,
        away_team_id: f.away_code ? teamMap.get(f.away_code) ?? null : null,
        home_label: f.home_label,
        away_label: f.away_label,
        status: "scheduled",
      },
      { onConflict: "match_number" }
    );
  }
}
