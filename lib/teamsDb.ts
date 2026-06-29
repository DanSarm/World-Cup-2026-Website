import { getSupabase } from "./supabaseServer";
import { WORLD_CUP_TEAMS } from "./teamsData";

let teamsSeedVerified = false;

export async function ensureTeamsSeeded(): Promise<void> {
  if (teamsSeedVerified) return;

  const supabase = getSupabase();
  const { count } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true });

  if (count && count >= WORLD_CUP_TEAMS.length) {
    teamsSeedVerified = true;
    return;
  }

  for (const t of WORLD_CUP_TEAMS) {
    await supabase.from("teams").upsert(
      {
        name: t.name,
        short_name: t.short_name,
        fifa_code: t.fifa_code,
        flag_emoji: t.flag_emoji,
        group_letter: t.group_letter,
      },
      { onConflict: "fifa_code" }
    );
  }

  teamsSeedVerified = true;
}

export async function getTeamIdByCode(fifaCode: string): Promise<string | null> {
  const supabase = getSupabase();
  await ensureTeamsSeeded();
  const { data } = await supabase
    .from("teams")
    .select("id")
    .eq("fifa_code", fifaCode)
    .maybeSingle();
  return data?.id ?? null;
}
