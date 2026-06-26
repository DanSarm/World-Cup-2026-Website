import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/apiAuth";
import {
  syncOddsForUpcomingMatches,
  syncOddsFromEspnForMatches,
  syncOddsFromPolymarketForMatches,
} from "@/lib/odds/sync";
import { isOddsApiConfigured } from "@/lib/odds/config";
import { getMatchesWithTeams } from "@/lib/data";
import { resolveMatchesForPicks } from "@/lib/resolvedMatches";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pickMatches = resolveMatchesForPicks(await getMatchesWithTeams());

  let result = await syncOddsFromPolymarketForMatches(pickMatches, { force: true });
  const espn = await syncOddsFromEspnForMatches(pickMatches, { force: true });
  if (espn.synced > 0) {
    result = {
      ...result,
      synced: result.synced + espn.synced,
      results: [...result.results, ...espn.results],
    };
  }

  if (isOddsApiConfigured()) {
    const paid = await syncOddsForUpcomingMatches({ force: true });
    if (paid.synced > 0) {
      result = {
        ...result,
        synced: result.synced + paid.synced,
        results: [...result.results, ...paid.results],
      };
    }
  }

  revalidatePath("/admin");
  revalidatePath("/picks");

  return NextResponse.json(result);
}
