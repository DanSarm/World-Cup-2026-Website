import {
  processWorldCupWinnerOdds,
  type ChampionOddsEntry,
} from "./championOdds";
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
    id: "bra",
    name: "Brazil",
    short_name: "Brazil",
    fifa_code: "BRA",
    flag_emoji: "",
    group_letter: "C",
  },
];

const ranked = processWorldCupWinnerOdds(
  [
    {
      id: "wc-winner",
      sport_key: "soccer_fifa_world_cup_winner",
      commence_time: "2026-06-11T00:00:00Z",
      home_team: "",
      away_team: "",
      bookmakers: [
        {
          key: "book1",
          title: "Book 1",
          markets: [
            {
              key: "outrights",
              outcomes: [
                { name: "Spain", price: 2 },
                { name: "France", price: 4 },
                { name: "Brazil", price: 4 },
              ],
            },
          ],
        },
      ],
    },
  ],
  teams
);

assert(ranked.length === 3, "maps three teams from outright market");
assert(ranked[0]?.team.fifa_code === "ESP", "Spain is favorite");
assert(
  ranked[0]!.impliedProbability > ranked[1]!.impliedProbability,
  "higher implied prob ranks first"
);

const empty: ChampionOddsEntry[] = processWorldCupWinnerOdds([], teams);
assert(empty.length === 0, "empty events returns empty list");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
