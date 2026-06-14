import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  removePushSubscriptionByEndpoint,
  upsertPushSubscription,
} from "@/lib/push/subscriptions";
import { isPushConfigured } from "@/lib/push/vapid";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Push notifications are not configured on this server." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const result = await upsertPushSubscription({
    playerId: session.id,
    subscription: parsed.data,
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Failed to save subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let endpoint: string | null = null;
  try {
    const body = (await request.json()) as { endpoint?: string };
    endpoint = body.endpoint ?? null;
  } catch {
    /* optional body */
  }

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await removePushSubscriptionByEndpoint(session.id, endpoint);
  return NextResponse.json({ ok: true });
}
