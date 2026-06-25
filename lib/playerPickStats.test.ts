import { computePlayerPickStats } from "./playerPickStats";
import type { PlayerPickSummary } from "./playerProfile";

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

function pick(
  status: PlayerPickSummary["status"],
  exact: boolean,
  correct: boolean
): PlayerPickSummary {
  return {
    matchId: "m",
    matchNumber: 1,
    stageLabel: "Group",
    groupLetter: "A",
    kickoffAt: null,
    homeLabel: "A",
    awayLabel: "B",
    homeCode: "AAA",
    awayCode: "BBB",
    predHome: 1,
    predAway: 0,
    predWinnerCode: null,
    actualHome: 1,
    actualAway: 0,
    status,
    points: exact ? 8 : correct ? 3 : 0,
    livePoints: null,
    breakdownLines: [],
    exactScore: exact,
    correctResult: correct,
  };
}

const stats = computePlayerPickStats([
  pick("scored", true, true),
  pick("scored", false, true),
  pick("scored", false, false),
  pick("upcoming", false, false),
]);

assert(stats.exact === 1, "counts exact");
assert(stats.correct === 1, "counts correct non-exact");
assert(stats.wrong === 1, "counts wrong");
assert(stats.decided === 3, "ignores upcoming");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
