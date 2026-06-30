import { formatEspnLiveClock } from "./liveClock";

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

assert(
  formatEspnLiveClock({
    displayClock: "45'+4'",
    type: {
      state: "in",
      name: "STATUS_HALFTIME",
      description: "Halftime",
      shortDetail: "HT",
    },
  }) === "Half time",
  "halftime → Half time"
);

assert(
  formatEspnLiveClock({
    displayClock: "67'",
    type: { state: "in", name: "STATUS_SECOND_HALF" },
  }) === "67'",
  "in play → display clock"
);

assert(
  formatEspnLiveClock({
    displayClock: "0'",
    type: { state: "pre", name: "STATUS_SCHEDULED" },
  }) === null,
  "pre-match → null"
);

assert(
  formatEspnLiveClock({
    displayClock: "105'+2'",
    period: 3,
    type: { state: "in", name: "STATUS_FIRST_HALF_EXTRA_TIME" },
  }) === "ET 105'+2'",
  "extra time → ET prefix"
);

assert(
  formatEspnLiveClock({
    displayClock: "0'",
    type: {
      state: "in",
      name: "STATUS_PENALTY_SHOOTOUT",
      description: "Penalty Shootout",
    },
  }) === "Penalties",
  "penalties → Penalties"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
