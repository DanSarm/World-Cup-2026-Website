import {
  calculatePrizePool,
  distributeRankedPrizes,
  paidPayoutPercent,
} from "./payouts";

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

const pot = calculatePrizePool(10);

const tieFirst = distributeRankedPrizes(
  [
    { playerId: "a", rank: 1 },
    { playerId: "b", rank: 1 },
    { playerId: "c", rank: 2 },
  ],
  pot
);
assert(
  tieFirst.get("a") === 137.5 && tieFirst.get("b") === 137.5,
  "two tied for 1st split 55% only"
);
assert(tieFirst.get("c") === 125, "solo 2nd place gets 25%");

const allFirst = distributeRankedPrizes(
  [
    { playerId: "a", rank: 1 },
    { playerId: "b", rank: 1 },
    { playerId: "c", rank: 1 },
    { playerId: "d", rank: 1 },
  ],
  pot
);
assert(
  allFirst.get("a") === 125 && allFirst.get("d") === 125,
  "everyone tied for 1st splits whole pool equally"
);

const fourWay = distributeRankedPrizes(
  [
    { playerId: "a", rank: 1 },
    { playerId: "b", rank: 1 },
    { playerId: "c", rank: 1 },
    { playerId: "d", rank: 1 },
    { playerId: "e", rank: 2 },
  ],
  pot
);
assert(
  fourWay.get("a") === 68.75 && fourWay.get("d") === 68.75,
  "four tied for 1st split 55% four ways when not everyone tied"
);
assert(fourWay.get("e") === 125, "next player gets 2nd-place prize");

const fifthPlace = distributeRankedPrizes(
  [
    { playerId: "a", rank: 1 },
    { playerId: "b", rank: 2 },
    { playerId: "c", rank: 3 },
    { playerId: "d", rank: 4 },
    { playerId: "e", rank: 5 },
  ],
  pot
);
assert((fifthPlace.get("e") ?? 0) === 0, "5th place gets no prize money");
assert(fifthPlace.get("d") === 25, "4th place still gets 5%");

assert(paidPayoutPercent(1) === 55, "1st place percent");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
