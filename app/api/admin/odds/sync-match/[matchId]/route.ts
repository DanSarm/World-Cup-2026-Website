import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { syncOddsForMatch } from "@/lib/odds/sync";
import { isOddsApiConfigured } from "@/lib/odds/config";
import { revalidatePath } from "next/cache";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await requireAdminApi();
  if (session instanceof Response) return session;

  if (!isOddsApiConfigured()) {
    return NextResponse.json(
      { error: "ODDS_API_KEY is not configured. Add it to .env.local." },
      { status: 503 }
    );
  }

  const { matchId } = await params;
  let force = false;
  let eventId: string | undefined;

  try {
    const body = await request.json();
    force = Boolean(body?.force);
    eventId = typeof body?.eventId === "string" ? body.eventId : undefined;
  } catch {
    // empty body is fine
  }

  const result = await syncOddsForMatch(matchId, {
    force,
    eventId,
    actorId: session.id,
  });

  revalidatePath("/admin");
  revalidatePath("/picks");

  return NextResponse.json(result);
}
