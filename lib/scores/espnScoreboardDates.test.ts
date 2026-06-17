import { espnScoreboardDatesForKickoff } from "./espnScores";

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

// Austria vs Jordan — 8 PM PT June 16 = 2026-06-17T04:00:00Z
const austriaJordan = espnScoreboardDatesForKickoff("2026-06-17T04:00:00Z");
assert(
  austriaJordan.includes("20260616"),
  "late-night US kickoff includes Pacific calendar day (June 16)"
);
assert(
  austriaJordan.includes("20260617"),
  "late-night US kickoff includes UTC calendar day (June 17)"
);

// Korea vs Czechia — afternoon US June 11
const koreaCzech = espnScoreboardDatesForKickoff("2026-06-12T02:00:00Z");
assert(koreaCzech.includes("20260611"), "includes US day before UTC for evening kickoff");
assert(koreaCzech.includes("20260612"), "includes UTC day");

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} tests passed.`);
