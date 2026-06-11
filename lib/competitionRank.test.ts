import { assignCompetitionRanks } from "./competitionRank";

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

const entries = [
  { name: "A", rank: 0, pts: 10 },
  { name: "B", rank: 0, pts: 10 },
  { name: "C", rank: 0, pts: 8 },
  { name: "D", rank: 0, pts: 8 },
  { name: "E", rank: 0, pts: 8 },
  { name: "F", rank: 0, pts: 5 },
];

assignCompetitionRanks(entries, (e) => e.pts);

assert(entries[0].rank === 1 && entries[1].rank === 1, "two-way tie for first");
assert(
  entries[2].rank === 2 && entries[3].rank === 2 && entries[4].rank === 2,
  "three-way tie for second place"
);
assert(entries[5].rank === 3, "next distinct score is third place");

const fourWay = [
  { name: "A", rank: 0, pts: 10 },
  { name: "B", rank: 0, pts: 10 },
  { name: "C", rank: 0, pts: 10 },
  { name: "D", rank: 0, pts: 10 },
  { name: "E", rank: 0, pts: 5 },
];

assignCompetitionRanks(fourWay, (e) => e.pts);

assert(
  fourWay.every((e, i) => (i < 4 ? e.rank === 1 : e.rank === 2)),
  "four-way tie for first, next player is second"
);

const scattered = [
  { name: "A", rank: 0, pts: 10 },
  { name: "X", rank: 0, pts: 5 },
  { name: "B", rank: 0, pts: 10 },
  { name: "Y", rank: 0, pts: 5 },
  { name: "C", rank: 0, pts: 10 },
  { name: "Z", rank: 0, pts: 5 },
  { name: "D", rank: 0, pts: 10 },
];

assignCompetitionRanks(scattered, (e) => e.pts);

assert(
  scattered.filter((e) => e.pts === 10).every((e) => e.rank === 1),
  "four-way tie stays first even when interleaved"
);
assert(
  scattered.filter((e) => e.pts === 5).every((e) => e.rank === 2),
  "next score tier is second place"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
