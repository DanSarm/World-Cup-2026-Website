import { getSupabase } from "@/lib/supabaseServer";

export async function hasNotificationBeenSent(
  playerId: string,
  key: string
): Promise<boolean> {
  const supabase = getSupabase();

  const { data: generic } = await supabase
    .from("notifications_sent")
    .select("player_id")
    .eq("player_id", playerId)
    .eq("notification_key", key)
    .maybeSingle();
  if (generic) return true;

  // Legacy pick reminders table (pre-notifications_sent migration)
  if (key.startsWith("pick_reminder:")) {
    const matchId = key.slice("pick_reminder:".length);
    const { data: legacy } = await supabase
      .from("pick_reminder_sent")
      .select("player_id")
      .eq("player_id", playerId)
      .eq("match_id", matchId)
      .maybeSingle();
    if (legacy) return true;
  }

  return false;
}

export async function markNotificationSent(
  playerId: string,
  key: string
): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("notifications_sent").upsert({
    player_id: playerId,
    notification_key: key,
    sent_at: new Date().toISOString(),
  });

  if (key.startsWith("pick_reminder:")) {
    const matchId = key.slice("pick_reminder:".length);
    await supabase.from("pick_reminder_sent").upsert({
      player_id: playerId,
      match_id: matchId,
      sent_at: new Date().toISOString(),
    });
  }
}
