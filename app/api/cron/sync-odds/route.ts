import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/apiAuth";
import { syncOddsForUpcomingMatches } from "@/lib/odds/sync";
import { isOddsApiConfigured } from "@/lib/odds/config";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOddsApiConfigured()) {
    return NextResponse.json({ skipped: true, reason: "ODDS_API_KEY not set" });
  }

  const result = await syncOddsForUpcomingMatches(null);
  revalidatePath("/admin");
  revalidatePath("/picks");

  return NextResponse.json(result);
}
