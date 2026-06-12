import { processPolymarketWinnerMarkets } from "./polymarketChampionOdds";
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

const teams: Team[] = [
  {
    id: "esp",
    name: "Spain",
    short_name: "Spain",
    fifa_code: "ESP",
    flag_emoji: "",
    group_letter: "H",
  },
  {
    id: "fra",
    name: "France",
    short_name: "France",
    fifa_code: "FRA",
    flag_emoji: "",
    group_letter: "I",
  },
  {
    id: "bih",
    name: "Bosnia and Herzegovina",
    short_name: "Bosnia",
    fifa_code: "BIH",
    flag_emoji: "",
    group_letter: "B",
  },
];

const ranked = processPolymarketWinnerMarkets(
  {
    markets: [
      {
        question: "Will Spain win the 2026 FIFA World Cup?",
        outcomes: '["Yes","No"]',
        outcomePrices: '["0.1645","0.8355"]',
      },
      {
        question: "Will France win the 2026 FIFA World Cup?",
        outcomes: '["Yes","No"]',
        outcomePrices: '["0.1605","0.8395"]',
      },
      {
        question: "Will Bosnia-Herzegovina win the 2026 FIFA World Cup?",
        outcomes: '["Yes","No"]',
        outcomePrices: '["0.0015","0.9985"]',
      },
      {
        question: "Will Team AM win the 2026 FIFA World Cup?",
        outcomes: '["Yes","No"]',
        outcomePrices: '["0.01","0.99"]',
      },
    ],
  },
  teams
);

assert(ranked.length === 3, "maps real teams and skips placeholders");
assert(ranked[0]?.team.fifa_code === "ESP", "Spain ranks first");
assert(
  Math.abs(ranked[0]!.impliedProbability - 0.1645) < 0.0001,
  "uses Yes price as probability"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
