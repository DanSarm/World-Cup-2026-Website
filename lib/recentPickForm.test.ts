import {
  buildPlayerRecentForm,
  classifyLivePickResult,
  classifyPickResult,
  isPickLiveEliminated,
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
assert(form[9] === "correct", "rightmost is latest match by kickoff (draw, not exact)");
assert(form[4] === "exact", "fifth slot is oldest of last six picks");
assert(form[0] === null, "pads early slots when fewer than ten results");

const outOfOrderKickoff: Match[] = [
  { ...matchBase, id: "early-num", match_number: 10, kickoff_at: "2026-06-10T18:00:00Z", home_score: 1, away_score: 0 },
  { ...matchBase, id: "late-num", match_number: 5, kickoff_at: "2026-06-15T18:00:00Z", home_score: 2, away_score: 2 },
];

const outOfOrderPreds: MatchPrediction[] = [
  pred("early-num", 1, 0),
  pred("late-num", 2, 2),
];

const chronologicalForm = buildPlayerRecentForm(
  "player-1",
  outOfOrderKickoff,
  outOfOrderPreds,
  DEFAULT_SCORING_CONFIG,
  2
);

assert(
  chronologicalForm[1] === "exact" && chronologicalForm[0] === "exact",
  "orders by kickoff_at, not match_number"
);

const formFive = buildPlayerRecentForm(
  "player-1",
  matches,
  predictions,
  DEFAULT_SCORING_CONFIG,
  5
);
assert(formFive.length === 5, "count override still works");

const sevenFinals: Match[] = [
  { ...matchBase, id: "f1", match_number: 1, kickoff_at: "2026-06-11T18:00:00Z", home_score: 2, away_score: 0 },
  { ...matchBase, id: "f2", match_number: 2, kickoff_at: "2026-06-12T18:00:00Z", home_score: 0, away_score: 0 },
  { ...matchBase, id: "f3", match_number: 3, kickoff_at: "2026-06-13T18:00:00Z", home_score: 1, away_score: 1 },
  { ...matchBase, id: "f4", match_number: 4, kickoff_at: "2026-06-14T18:00:00Z", home_score: 3, away_score: 2 },
  { ...matchBase, id: "f5", match_number: 5, kickoff_at: "2026-06-15T18:00:00Z", home_score: 0, away_score: 1 },
  { ...matchBase, id: "f6", match_number: 6, kickoff_at: "2026-06-16T18:00:00Z", home_score: 2, away_score: 2 },
  { ...matchBase, id: "f7", match_number: 7, kickoff_at: "2026-06-17T18:00:00Z", home_score: 1, away_score: 0 },
];

const sixPicksOnly: MatchPrediction[] = [
  pred("f1", 2, 0),
  pred("f2", 0, 0),
  pred("f3", 0, 0),
  pred("f4", 2, 1),
  pred("f5", 0, 0),
  pred("f6", 1, 1),
  // f7: no pick — grey missed dot, not scored as 0-0
];

const sevenSlotForm = buildPlayerRecentForm(
  "player-1",
  sevenFinals,
  sixPicksOnly,
  DEFAULT_SCORING_CONFIG
);

assert(
  sevenSlotForm.filter((slot) => slot != null).length === 7,
  "shows a dot for every finished match"
);
assert(
  sevenSlotForm[9] === "missed",
  "missing pick on f7 shows grey missed dot"
);
assert(
  sevenSlotForm[4] === "exact",
  "f2 0-0 pick on 0-0 final is exact"
);

const liveMatch: Match = {
  ...matchBase,
  id: "live",
  match_number: 7,
  status: "live",
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
    "live-pending",
  "away win pick still possible when home leads"
);
assert(
  classifyLivePickResult(liveMatch, pred("live", 1, 2), DEFAULT_SCORING_CONFIG) ===
    "live-pending",
  "away win scoreline still possible when home leads"
);

const trailingHomePick: Match = {
  ...matchBase,
  id: "live2",
  match_number: 8,
  status: "live",
  home_score: 0,
  away_score: 1,
  winner_team_id: null,
};
assert(
  classifyLivePickResult(trailingHomePick, pred("live2", 4, 1), DEFAULT_SCORING_CONFIG) ===
    "live-pending",
  "home win pick still possible when away leads"
);
assert(
  !isPickLiveEliminated(
    trailingHomePick,
    pred("live2", 4, 1),
    DEFAULT_SCORING_CONFIG
  ),
  "4-1 not eliminated at live 0-1"
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
