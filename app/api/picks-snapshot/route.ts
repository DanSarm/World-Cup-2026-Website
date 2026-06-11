import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPicksSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getPicksSnapshot(session.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Picks snapshot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
