import {
  assertSafePredictionWrite,
  wouldWipeConfirmedPick,
} from "./predictionGuard";

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
  wouldWipeConfirmedPick(
    { pred_home_score: 2, pred_away_score: 1, pick_confirmed: true },
    { pred_home_score: 0, pred_away_score: 0 }
  ),
  "detects confirmed 2-1 -> 0-0 wipe"
);

assert(
  !wouldWipeConfirmedPick(
    { pred_home_score: 0, pred_away_score: 0, pick_confirmed: true },
    { pred_home_score: 0, pred_away_score: 0 }
  ),
  "allows confirmed 0-0 -> 0-0"
);

assert(
  !wouldWipeConfirmedPick(
    { pred_home_score: 2, pred_away_score: 0, pick_confirmed: false },
    { pred_home_score: 0, pred_away_score: 0 }
  ),
  "allows unconfirmed row to become 0-0"
);

let threw = false;
try {
  assertSafePredictionWrite(
    { pred_home_score: 3, pred_away_score: 1, pick_confirmed: true },
    { pred_home_score: 0, pred_away_score: 0 },
    "test"
  );
} catch {
  threw = true;
}
assert(threw, "assertSafePredictionWrite throws on wipe");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
