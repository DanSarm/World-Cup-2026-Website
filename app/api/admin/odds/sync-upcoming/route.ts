import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { syncOddsForUpcomingMatches, syncOddsFromEspnForMatches, syncOddsFromPolymarketForMatches } from "@/lib/odds/sync";
import { isOddsApiConfigured } from "@/lib/odds/config";
import { validateOddsSchema } from "@/lib/odds/schemaCheck";
import { getMatchesWithTeams } from "@/lib/data";
import { revalidatePath } from "next/cache";

export async function POST() {
  const session = await requireAdminApi();
  if (session instanceof Response) return session;

  if (!isOddsApiConfigured()) {
    const upcoming = (await getMatchesWithTeams()).filter(
      (match) => match.status === "scheduled"
    );
    const poly = await syncOddsFromPolymarketForMatches(upcoming, { force: true });
    const espn = await syncOddsFromEspnForMatches(upcoming, { force: true });
    revalidatePath("/admin");
    revalidatePath("/picks");
    return NextResponse.json({
      synced: poly.synced + espn.synced,
      source: "free",
      polymarket: poly,
      espn,
    });
  }

  const schema = await validateOddsSchema();
  if (!schema.ok) {
    return NextResponse.json({ error: schema.error, schemaError: schema.error }, { status: 503 });
  }

  const upcoming = (await getMatchesWithTeams()).filter(
    (match) => match.status === "scheduled"
  );

  let result = await syncOddsFromPolymarketForMatches(upcoming, { force: true });
  if (result.synced === 0) {
    const espnResult = await syncOddsFromEspnForMatches(upcoming, { force: true });
    if (espnResult.synced > 0) {
      result = {
        ...result,
        synced: result.synced + espnResult.synced,
        results: [...result.results, ...espnResult.results],
      };
    }
  }

  const paidResult = await syncOddsForUpcomingMatches({
    actorId: session.id,
    skipSchemaCheck: true,
    force: true,
  });
  if (paidResult.synced > 0) {
    result = {
      ...result,
      synced: result.synced + paidResult.synced,
      results: [...result.results, ...paidResult.results],
    };
  }
  if (paidResult.schemaError && result.synced === 0) {
    return NextResponse.json({ error: paidResult.schemaError, ...result }, { status: 502 });
  }
  revalidatePath("/admin");
  revalidatePath("/picks");

  return NextResponse.json(result);
}
