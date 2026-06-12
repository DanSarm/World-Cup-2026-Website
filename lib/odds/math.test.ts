import {
  probabilityToBonus,
  calculateNoVigProbabilities,
  championProbabilityToLongshotBonus,
  isCompetitiveThreeWayMatch,
  groupStageOutcomeBonusesFromImplied,
} from "./math";

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

assert(probabilityToBonus(0.55) === 0, "prob >= 0.35 → 0");
assert(probabilityToBonus(0.47) === 0, "47% → 0");
assert(probabilityToBonus(0.28) === 0, "prob >= 0.25 → 0");
assert(probabilityToBonus(0.24) === 1, "prob >= 0.20 → 1");
assert(probabilityToBonus(0.22) === 1, "22% → +1");
assert(probabilityToBonus(0.15) === 4, "prob >= 0.10 → 4");
assert(probabilityToBonus(0.07) === 6, "prob >= 0.05 → 6");
assert(probabilityToBonus(0.03) === 8, "prob < 0.05 → 8");

assert(
  isCompetitiveThreeWayMatch(0.37, 0.3, 0.33),
  "Korea 37/30/33 is competitive"
);
const koreaBonuses = groupStageOutcomeBonusesFromImplied(0.37, 0.3, 0.33);
assert(
  koreaBonuses.home === 0 && koreaBonuses.draw === 0 && koreaBonuses.away === 0,
  "Korea → all bonuses 0"
);

assert(
  isCompetitiveThreeWayMatch(0.47, 0.27, 0.26),
  "Netherlands 47/27/26 is competitive"
);
const nedBonuses = groupStageOutcomeBonusesFromImplied(0.47, 0.27, 0.26);
assert(
  nedBonuses.home === 0 && nedBonuses.draw === 0 && nedBonuses.away === 0,
  "Netherlands → all bonuses 0"
);

assert(
  !isCompetitiveThreeWayMatch(0.48, 0.28, 0.24),
  "USA 48/28/24 is not competitive (Paraguay < 25%)"
);
const usaBonuses = groupStageOutcomeBonusesFromImplied(0.48, 0.28, 0.24);
assert(usaBonuses.home === 0, "USA 48% → 0");
assert(usaBonuses.draw === 0, "Draw 28% → 0");
assert(usaBonuses.away === 1, "Paraguay 24% → +1");

assert(
  !isCompetitiveThreeWayMatch(0.78, 0.15, 0.07),
  "Switzerland 78/15/7 is not competitive"
);
const swissBonuses = groupStageOutcomeBonusesFromImplied(0.78, 0.15, 0.07);
assert(swissBonuses.home === 0, "Switzerland 78% → 0");
assert(swissBonuses.draw === 4, "draw 15% → +4");
assert(swissBonuses.away === 6, "qatar 7% → +6");

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
