import { isConfirmedPick, getEffectiveMatchPrediction } from "./pickUtils";
import type { Match, MatchPrediction } from "./types";

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

const pred = (
  overrides: Partial<MatchPrediction> = {}
): MatchPrediction => ({
  id: "1",
  player_id: "p1",
  match_id: "m1",
  pred_home_score: 2,
  pred_away_score: 1,
  pred_winner_team_id: null,
  points: 0,
  exact_score: false,
  correct_result: false,
  ...overrides,
});

assert(isConfirmedPick(pred({ pick_confirmed: true })), "explicit true counts");
assert(isConfirmedPick(pred({ pick_confirmed: undefined })), "legacy undefined counts");
assert(!isConfirmedPick(pred({ pick_confirmed: false })), "explicit false excluded");

const match: Pick<Match, "status" | "kickoff_at"> = {
  status: "final",
  kickoff_at: "2026-06-13T00:00:00Z",
};

assert(
  getEffectiveMatchPrediction(match, pred({ pick_confirmed: undefined })) != null,
  "legacy pick scores on leaderboard"
);
assert(
  getEffectiveMatchPrediction(match, pred({ pick_confirmed: false }))?.pred_home_score === 2,
  "existing row keeps stored scores even when unconfirmed"
);
assert(
  getEffectiveMatchPrediction(match, undefined)?.pred_away_score === 0,
  "missing row on locked match defaults to 0-0"
);

const openMatch: Pick<Match, "status" | "kickoff_at"> = {
  status: "scheduled",
  kickoff_at: "2099-06-13T00:00:00Z",
};
assert(
  getEffectiveMatchPrediction(openMatch, undefined) == null,
  "open match without pick stays unscored"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
