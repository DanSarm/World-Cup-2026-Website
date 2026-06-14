import { getSupabase } from "@/lib/supabaseServer";

export interface PushSubscriptionRow {
  id: string;
  player_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function listPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("push_subscriptions").select("*");
  if (error) {
    console.error("listPushSubscriptions:", error.message);
    return [];
  }
  return (data ?? []) as PushSubscriptionRow[];
}

export async function listPushSubscriptionsForPlayer(
  playerId: string
): Promise<PushSubscriptionRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("player_id", playerId);
  if (error) {
    console.error("listPushSubscriptionsForPlayer:", error.message);
    return [];
  }
  return (data ?? []) as PushSubscriptionRow[];
}

export async function upsertPushSubscription(input: {
  playerId: string;
  subscription: StoredPushSubscription;
  userAgent?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      player_id: input.playerId,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      user_agent: input.userAgent ?? null,
    },
    { onConflict: "player_id,endpoint" }
  );

  if (error) {
    console.error("upsertPushSubscription:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removePushSubscription(id: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("push_subscriptions").delete().eq("id", id);
}

export async function removePushSubscriptionByEndpoint(
  playerId: string,
  endpoint: string
): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("player_id", playerId)
    .eq("endpoint", endpoint);
}
