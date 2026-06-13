import { normalizeDisplayName, normalizedDisplayNameKey } from "./playerNames";

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
  normalizeDisplayName("  Brian h  ") === "Brian h",
  "trims and collapses spaces"
);
assert(
  normalizedDisplayNameKey("Brian H") === normalizedDisplayNameKey("brian h"),
  "case-insensitive keys match"
);
assert(
  normalizedDisplayNameKey("Brian h ") === normalizedDisplayNameKey("Brian h"),
  "trailing space does not create a new key"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
