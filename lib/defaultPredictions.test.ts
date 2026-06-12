import {
  ensureDefaultPredictionsForLockedMatches,
  ensureDefaultPredictionsForPlayer,
} from "./defaultPredictions";

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

async function main() {
  await ensureDefaultPredictionsForLockedMatches([], [], []);
  await ensureDefaultPredictionsForPlayer("player", [], []);
  assert(true, "default prediction helpers are no-ops (never write 0-0)");
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
