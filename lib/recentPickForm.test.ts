import {
  buildPlayerRecentForm,
  classifyLivePickResult,
  classifyPickResult,
} from "./recentPickForm";
import { DEFAULT_SCORING_CONFIG } from "./scoringConfig";
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

const matchBase: Match = {
  id: "m1",
  match_number: 1,
  stage: "group",
  group_letter: "A",
  kickoff_at: "2026-06-11T18:00:00Z",
  venue: null,
  city: null,
  home_team_id: "home",
  away_team_id: "away",
  home_label: "Home",
  away_label: "Away",
  status: "final",
  home_score: 2,
  away_score: 1,
  winner_team_id: "home",
  decided_by_penalties: false,
  home_win_bonus: 0,
  draw_bonus: 0,
  away_win_bonus: 0,
  home_advance_bonus: 0,
  away_advance_bonus: 0,
  odds_event_id: null,
  odds_last_synced_at: null,
  odds_locked_at: null,
  odds_status: "not_synced",
  home_implied_probability: null,
  draw_implied_probability: null,
  away_implied_probability: null,
  home_advance_probability: null,
  away_advance_probability: null,
  odds_source_note: null,
};

const pred = (
  matchId: string,
  home: number,
  away: number
): MatchPrediction => ({
  id: `p-${matchId}`,
  player_id: "player-1",
  match_id: matchId,
  pred_home_score: home,
  pred_away_score: away,
  pred_winner_team_id: null,
  pick_confirmed: true,
  points: 0,
  exact_score: false,
  correct_result: false,
});

assert(
  classifyPickResult(matchBase, pred("m1", 2, 1), DEFAULT_SCORING_CONFIG) ===
    "exact",
  "exact score and correct winner"
);
assert(
  classifyPickResult(matchBase, pred("m1", 3, 1), DEFAULT_SCORING_CONFIG) ===
    "correct",
  "correct winner without exact score"
);
assert(
  classifyPickResult(matchBase, pred("m1", 1, 2), DEFAULT_SCORING_CONFIG) ===
    "wrong",
  "wrong winner"
);

const matches: Match[] = [
  matchBase,
  { ...matchBase, id: "m2", match_number: 2, home_score: 0, away_score: 0 },
  { ...matchBase, id: "m3", match_number: 3, home_score: 1, away_score: 0 },
  { ...matchBase, id: "m4", match_number: 4, home_score: 3, away_score: 2 },
  { ...matchBase, id: "m5", match_number: 5, home_score: 0, away_score: 1 },
  { ...matchBase, id: "m6", match_number: 6, home_score: 2, away_score: 2 },
];

const predictions: MatchPrediction[] = [
  pred("m1", 2, 1),
  pred("m2", 0, 0),
  pred("m3", 2, 0),
  pred("m4", 3, 2),
  pred("m5", 2, 0),
  pred("m6", 1, 1),
];

const form = buildPlayerRecentForm(
  "player-1",
  matches,
  predictions,
  DEFAULT_SCORING_CONFIG
);

assert(form.length === 10, "returns ten slots");
assert(form[9] === "correct", "rightmost is latest match (draw, not exact)");
assert(form[4] === "exact", "fifth slot is oldest of last six picks");
assert(form[0] === null, "pads early slots when fewer than ten results");

const formFive = buildPlayerRecentForm(
  "player-1",
  matches,
  predictions,
  DEFAULT_SCORING_CONFIG,
  5
);
assert(formFive.length === 5, "count override still works");

const liveMatch: Match = {
  ...matchBase,
  id: "live",
  match_number: 7,
  status: "locked",
  home_score: 1,
  away_score: 0,
  winner_team_id: null,
};

assert(
  classifyLivePickResult(liveMatch, pred("live", 1, 0), DEFAULT_SCORING_CONFIG) ===
    "live-exact",
  "live exact score"
);
assert(
  classifyLivePickResult(liveMatch, pred("live", 2, 0), DEFAULT_SCORING_CONFIG) ===
    "live-correct",
  "live correct winner"
);
assert(
  classifyLivePickResult(liveMatch, pred("live", 0, 1), DEFAULT_SCORING_CONFIG) ===
    "live-wrong",
  "away win pick wrong when home leads"
);
assert(
  classifyLivePickResult(liveMatch, pred("live", 1, 2), DEFAULT_SCORING_CONFIG) ===
    "live-wrong",
  "away win scoreline wrong when home leads"
);
assert(
  classifyLivePickResult(liveMatch, pred("live", 2, 0), DEFAULT_SCORING_CONFIG) ===
    "live-correct",
  "home win pick correct when home leads"
);
assert(
  classifyLivePickResult(liveMatch, pred("live", 1, 1), DEFAULT_SCORING_CONFIG) ===
    "live-pending",
  "live pending when still possible"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
