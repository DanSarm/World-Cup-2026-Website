import {
  buildPolymarketMatchSlugs,
  processPolymarketMatchMarkets,
} from "./polymarketMatchOdds";
import type { Team } from "@/lib/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name}`);
  }
}

const rsa: Team = {
  id: "rsa",
  name: "South Africa",
  short_name: "S. Africa",
  fifa_code: "RSA",
  group_letter: "A",
  flag_emoji: "🇿🇦",
};

const can: Team = {
  id: "can",
  name: "Canada",
  short_name: "Canada",
  fifa_code: "CAN",
  group_letter: "B",
  flag_emoji: "🇨🇦",
};

const slugs = buildPolymarketMatchSlugs(rsa, can, "2026-06-28T20:00:00Z");
assert(slugs.includes("fifwc-rsa-can-2026-06-28"), "builds polymarket slug");

const event = {
  slug: "fifwc-rsa-can-2026-06-28",
  markets: [
    {
      question: "Will Canada win on 2026-06-28?",
      outcomes: '["Yes","No"]',
      outcomePrices: '["0.575","0.425"]',
    },
    {
      question: "Will South Africa win on 2026-06-28?",
      outcomes: '["Yes","No"]',
      outcomePrices: '["0.165","0.835"]',
    },
    {
      question: "Will South Africa vs. Canada end in a draw?",
      outcomes: '["Yes","No"]',
      outcomePrices: '["0.265","0.735"]',
    },
  ],
};

const probs = processPolymarketMatchMarkets(event, rsa, can);
assert(probs != null, "parses polymarket match markets");
if (probs) {
  assert(probs.away > probs.home, "Canada favored");
  const total = probs.home + probs.draw + probs.away;
  assert(Math.abs(total - 1) < 0.01, "3-way probabilities sum to ~1");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
