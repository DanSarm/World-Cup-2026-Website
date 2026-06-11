import { calculateExactScoreFireBonus, pickPreviewLabel } from "./fireBonus";
import {
  capGroupMatchPoints,
  previewPickRewards,
  DEFAULT_SCORING_CONFIG,
} from "./scoringConfig";
import { scoreMatchPrediction } from "./scoring";
import type { Match } from "./types";

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
  calculateExactScoreFireBonus({
    isExactScore: true,
    isDraw: true,
    totalGoals: 0,
    winningMargin: 0,
    outcomeBonus: 4,
  }) === 0,
  "exact 0-0 draw fire = 0"
);

assert(
  calculateExactScoreFireBonus({
    isExactScore: true,
    isDraw: false,
    totalGoals: 2,
    winningMargin: 2,
    outcomeBonus: 0,
  }) === 0,
  "favorite 2-0 fire = 0"
);

assert(
  calculateExactScoreFireBonus({
    isExactScore: true,
    isDraw: false,
    totalGoals: 1,
    winningMargin: 1,
    outcomeBonus: 6,
  }) === 2,
  "miracle 1-0 fire = 2"
);

assert(capGroupMatchPoints(20, DEFAULT_SCORING_CONFIG) === 18, "cap at 18");

assert(pickPreviewLabel(8) === "Solid pick", "8 pts = Solid pick");
assert(pickPreviewLabel(10) === "Nice pick", "10 pts = Nice pick");
assert(pickPreviewLabel(14) === "Brave pick 🔥", "14 pts = Brave pick");
assert(pickPreviewLabel(18) === "Miracle pick 🚀", "18 pts = Miracle pick");

const bonusDefaults = {
  home_win_bonus: 0,
  draw_bonus: 4,
  away_win_bonus: 6,
  home_advance_bonus: 0,
  away_advance_bonus: 0,
  odds_event_id: null,
  odds_last_synced_at: null,
  odds_locked_at: null,
  odds_status: "synced" as const,
  home_implied_probability: null,
  draw_implied_probability: null,
  away_implied_probability: null,
  home_advance_probability: null,
  away_advance_probability: null,
  odds_source_note: null,
};

const suiQat: Match = {
  id: "sq",
  match_number: 8,
  stage: "group",
  group_letter: "B",
  kickoff_at: null,
  venue: null,
  city: null,
  home_team_id: "sui",
  away_team_id: "qat",
  home_label: "Switzerland",
  away_label: "Qatar",
  status: "final",
  home_score: 0,
  away_score: 0,
  winner_team_id: null,
  decided_by_penalties: false,
  ...bonusDefaults,
};

function score(actualHome: number, actualAway: number, predHome: number, predAway: number) {
  return scoreMatchPrediction(
    { ...suiQat, home_score: actualHome, away_score: actualAway },
    { pred_home_score: predHome, pred_away_score: predAway, pred_winner_team_id: null }
  ).points;
}

assert(score(2, 0, 2, 0) === 8, "Switzerland 2-0 exact = 8");
assert(score(5, 0, 5, 0) === 10, "Switzerland 5-0 exact = 10");
assert(score(1, 1, 1, 1) === 12, "Draw 1-1 exact = 12");
assert(score(0, 1, 0, 1) === 16, "Qatar 1-0 exact = 16");
assert(score(0, 5, 0, 5) === 18, "Qatar 5-0 exact = 18");
assert(score(1, 3, 0, 2) === 10, "Qatar 3-1 vs pick 2-0 = 10");

const preview = previewPickRewards(suiQat, 5, 0, DEFAULT_SCORING_CONFIG);
assert(preview.maxPoints === 10, "preview Switzerland 5-0 max = 10");
assert(preview.label === "Nice pick", "preview Switzerland 5-0 label");

const qatPreview = previewPickRewards(suiQat, 0, 5, DEFAULT_SCORING_CONFIG);
assert(qatPreview.maxPoints === 18, "preview Qatar 5-0 max = 18");
assert(qatPreview.label === "Miracle pick 🚀", "preview Qatar 5-0 label");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
