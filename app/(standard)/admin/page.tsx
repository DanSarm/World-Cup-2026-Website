import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/auth";
import { getPlayers, getMatchesWithTeams, getTeams } from "@/lib/data";
import { getSupabase } from "@/lib/supabaseServer";
import { AdminClient } from "@/components/AdminClient";
import { isOddsApiConfigured } from "@/lib/odds/config";
import { validateOddsSchema } from "@/lib/odds/schemaCheck";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.is_admin) redirect("/");

  const [players, matches, teams, settings, oddsSchema] = await Promise.all([
    getPlayers(),
    getMatchesWithTeams(),
    getTeams(),
    getSettings(),
    validateOddsSchema(),
  ]);

  const supabase = getSupabase();
  const { data: auditLog } = await supabase
    .from("audit_log")
    .select("id, action, created_at, actor_player_id")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <AdminClient
      players={players}
      matches={matches}
      teams={teams}
      settings={settings}
      auditLog={auditLog ?? []}
      oddsApiConfigured={isOddsApiConfigured()}
      oddsSchemaOk={oddsSchema.ok}
      oddsSchemaError={oddsSchema.error}
    />
  );
}
