import assert from "node:assert/strict";
import {
  buildExactScoreNotification,
  buildRankUpNotification,
} from "./builders";
import type { Match } from "../types";

const match: Match = {
  id: "m1",
  match_number: 1,
  stage: "group",
  group_letter: "A",
  kickoff_at: "2026-06-15T18:00:00.000Z",
  venue: null,
  city: null,
  home_team_id: "h",
  away_team_id: "a",
  home_label: "USA",
  away_label: "Mexico",
  status: "final",
  home_score: 2,
  away_score: 1,
  winner_team_id: "h",
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

const exact = buildExactScoreNotification(match, 18);
assert.equal(exact.dedupeKey, "exact_score:m1");
assert.match(exact.payload.body, /2–1/);

const rank = buildRankUpNotification(match, 2, 3);
assert.equal(rank.dedupeKey, "rank_up:m1");
assert.match(rank.payload.body, /#2/);

console.log("builders.test.ts: all assertions passed");
