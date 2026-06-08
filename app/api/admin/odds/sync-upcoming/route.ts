import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { syncOddsForUpcomingMatches } from "@/lib/odds/sync";
import { isOddsApiConfigured } from "@/lib/odds/config";
import { validateOddsSchema } from "@/lib/odds/schemaCheck";
import { revalidatePath } from "next/cache";

export async function POST() {
  const session = await requireAdminApi();
  if (session instanceof Response) return session;

  if (!isOddsApiConfigured()) {
    return NextResponse.json(
      { error: "ODDS_API_KEY is not configured. Add it to .env.local." },
      { status: 503 }
    );
  }

  const schema = await validateOddsSchema();
  if (!schema.ok) {
    return NextResponse.json({ error: schema.error, schemaError: schema.error }, { status: 503 });
  }

  const result = await syncOddsForUpcomingMatches({ actorId: session.id, skipSchemaCheck: true });
  if (result.schemaError) {
    return NextResponse.json({ error: result.schemaError, ...result }, { status: 502 });
  }
  revalidatePath("/admin");
  revalidatePath("/picks");

  return NextResponse.json(result);
}
