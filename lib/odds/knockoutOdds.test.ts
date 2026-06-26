import { processKnockoutOddsFromH2h, type OddsApiEvent } from "./theOddsApi";
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

const usa: Team = {
  id: "usa",
  name: "United States",
  short_name: "USA",
  fifa_code: "USA",
  group_letter: "D",
  flag_emoji: "🇺🇸",
};

const bosnia: Team = {
  id: "bih",
  name: "Bosnia and Herzegovina",
  short_name: "Bosnia",
  fifa_code: "BIH",
  group_letter: "E",
  flag_emoji: null,
};

const h2hThreeWay: OddsApiEvent = {
  id: "evt-1",
  sport_key: "soccer_fifa_world_cup",
  commence_time: "2026-07-01T20:00:00Z",
  home_team: "United States",
  away_team: "Bosnia and Herzegovina",
  bookmakers: [
    {
      key: "draftkings",
      title: "DraftKings",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "United States", price: 1.8 },
            { name: "Draw", price: 3.5 },
            { name: "Bosnia and Herzegovina", price: 4.5 },
          ],
        },
      ],
    },
  ],
};

const drawNoBet: OddsApiEvent = {
  ...h2hThreeWay,
  bookmakers: [
    {
      key: "fanduel",
      title: "FanDuel",
      markets: [
        {
          key: "draw_no_bet",
          outcomes: [
            { name: "United States", price: 1.45 },
            { name: "Bosnia and Herzegovina", price: 2.75 },
          ],
        },
      ],
    },
  ],
};

const threeWay = processKnockoutOddsFromH2h(h2hThreeWay, "m1", usa, bosnia, "the_odds_api");
assert(threeWay != null, "3-way h2h produces knockout odds");
if (threeWay) {
  const total = threeWay.homeAdvanceImplied + threeWay.awayAdvanceImplied;
  assert(Math.abs(total - 1) < 0.001, "3-way home/away shares sum to 1");
  assert(threeWay.homeAdvanceImplied > threeWay.awayAdvanceImplied, "USA favored in sample");
}

const twoWay = processKnockoutOddsFromH2h(drawNoBet, "m1", usa, bosnia, "the_odds_api");
assert(twoWay != null, "draw_no_bet produces knockout odds");
if (twoWay) {
  assert(twoWay.homeAdvanceImplied > 0.5, "draw_no_bet favors home");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
