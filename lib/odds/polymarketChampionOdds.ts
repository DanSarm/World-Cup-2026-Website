import type { Team } from "@/lib/types";
import { teamNameMatches } from "./teamAliases";
import type { ChampionOddsEntry } from "./championOdds";

const POLYMARKET_WINNER_SLUG = "world-cup-winner";
const WINNER_QUESTION =
  /^Will (.+?) win the 2026 FIFA World Cup\?$/i;

type PolymarketMarket = {
  question?: string;
  outcomes?: string;
  outcomePrices?: string;
};

type PolymarketEvent = {
  title?: string;
  markets?: PolymarketMarket[];
};

function parseTeamFromQuestion(question: string): string | null {
  const match = question.match(WINNER_QUESTION);
  if (!match) return null;
  const name = match[1].trim();
  if (/^team [a-z]{1,2}$/i.test(name)) return null;
  if (/^any other team$/i.test(name)) return null;
  return name;
}

/** Free prediction-market win probabilities (no API key). */
export function processPolymarketWinnerMarkets(
  event: PolymarketEvent,
  teams: Team[]
): ChampionOddsEntry[] {
  const entries: ChampionOddsEntry[] = [];

  for (const market of event.markets ?? []) {
    const question = market.question?.trim();
    if (!question) continue;

    const candidate = parseTeamFromQuestion(question);
    if (!candidate) continue;

    const team = teams.find((t) => teamNameMatches(candidate, t));
    if (!team) continue;

    if (!market.outcomes || !market.outcomePrices) continue;

    let outcomes: string[];
    let prices: string[];
    try {
      outcomes = JSON.parse(market.outcomes) as string[];
      prices = JSON.parse(market.outcomePrices) as string[];
    } catch {
      continue;
    }

    const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === "yes");
    if (yesIndex < 0) continue;

    const probability = Number(prices[yesIndex]);
    if (!Number.isFinite(probability) || probability <= 0) continue;

    entries.push({ team, impliedProbability: probability });
  }

  return entries.sort((a, b) => b.impliedProbability - a.impliedProbability);
}

export async function fetchPolymarketWorldCupWinnerOdds(
  teams: Team[]
): Promise<ChampionOddsEntry[]> {
  const res = await fetch(
    `https://gamma-api.polymarket.com/events/slug/${POLYMARKET_WINNER_SLUG}`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) {
    throw new Error(`Polymarket winner odds error ${res.status}`);
  }

  const event = (await res.json()) as PolymarketEvent;
  return processPolymarketWinnerMarkets(event, teams);
}
