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
  correct: boolean,
  scorelineMatch = exact
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
    scorelineMatch,
    actualWinnerCode: null,
    decidedByPenalties: false,
    outcomeNote: scorelineMatch && !exact ? "Wrong advancer" : null,
  };
}

const stats = computePlayerPickStats([
  pick("scored", true, true),
  pick("scored", false, true),
  pick("scored", false, false),
  pick("scored", false, false, true),
  pick("upcoming", false, false),
]);

assert(stats.exact === 1, "counts scoring exact");
assert(stats.correct === 1, "counts correct non-exact");
assert(stats.wrong === 2, "counts wrong including scoreline-only miss");
assert(stats.decided === 4, "ignores upcoming");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
