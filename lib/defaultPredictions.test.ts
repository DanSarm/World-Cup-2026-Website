import { listMissingDefaultPickRows } from "./defaultPredictions";
import type { Match, MatchPrediction, Player } from "./types";

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

const player = (id: string): Player => ({
  id,
  display_name: id,
  avatar_emoji: "⚽",
  paid: true,
  is_admin: false,
  created_at: "",
});

const match = (id: string, overrides: Partial<Match> = {}): Match => ({
  id,
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
  home_score: 1,
  away_score: 0,
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
  ...overrides,
});

const pred = (
  playerId: string,
  matchId: string,
  overrides: Partial<MatchPrediction> = {}
): MatchPrediction => ({
  id: `${playerId}-${matchId}`,
  player_id: playerId,
  match_id: matchId,
  pred_home_score: 2,
  pred_away_score: 1,
  pred_winner_team_id: null,
  pick_confirmed: true,
  points: 0,
  exact_score: false,
  correct_result: false,
  ...overrides,
});

const rows = listMissingDefaultPickRows(
  [match("m1"), match("m2", { status: "scheduled", kickoff_at: "2099-01-01T00:00:00Z" })],
  [player("p1"), player("p2")],
  [pred("p1", "m1")]
);

assert(rows.length === 1, "creates defaults for locked matches only");
assert(
  rows.every((row) => row.pred_home_score === 0 && row.pred_away_score === 0),
  "defaults are 0-0"
);
assert(
  rows.some((row) => row.player_id === "p2" && row.match_id === "m1"),
  "fills missing player on locked match"
);
assert(
  !rows.some((row) => row.match_id === "m2"),
  "skips matches that have not started"
);
assert(
  !rows.some((row) => row.player_id === "p1" && row.match_id === "m1"),
  "skips players who already have a prediction row"
);

const rowsWithUnconfirmed = listMissingDefaultPickRows(
  [match("m1")],
  [player("p1")],
  [pred("p1", "m1", { pick_confirmed: false })]
);
assert(
  rowsWithUnconfirmed.length === 0,
  "does not replace an existing unconfirmed pick row"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
