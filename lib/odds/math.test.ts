import { probabilityToBonus, calculateNoVigProbabilities, championProbabilityToLongshotBonus } from "./math";

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

assert(probabilityToBonus(0.55) === 0, "prob >= 0.50 → 0");
assert(probabilityToBonus(0.4) === 1, "prob >= 0.35 → 1");
assert(probabilityToBonus(0.25) === 2, "prob >= 0.20 → 2");
assert(probabilityToBonus(0.15) === 4, "prob >= 0.10 → 4");
assert(probabilityToBonus(0.07) === 6, "prob >= 0.05 → 6");
assert(probabilityToBonus(0.03) === 8, "prob < 0.05 → 8");

assert(probabilityToBonus(0.15) === 4, "draw 15% → +4");
assert(probabilityToBonus(0.07) === 6, "qatar 7% → +6");

const noVig = calculateNoVigProbabilities({ home: 0.5, draw: 0.3, away: 0.3 });
assert(
  Math.abs(noVig.home + noVig.draw + noVig.away - 1) < 0.001,
  "no-vig probabilities sum to 1"
);

assert(championProbabilityToLongshotBonus(0.16) === 0, "champion 16% longshot = 0");
assert(championProbabilityToLongshotBonus(0.04) === 10, "champion 4% longshot = 10");
assert(championProbabilityToLongshotBonus(0.005) === 25, "champion <1% longshot = 25");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
