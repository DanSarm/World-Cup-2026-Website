import assert from "node:assert/strict";
import {
  buildPickReminderPayload,
  findPickReminderForPlayer,
  isInPickReminderWindow,
  minutesUntilKickoff,
} from "./pickReminders";
import { PICK_REMINDER_MINUTES } from "./pickReminderConstants";
import type { Match } from "./types";

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "match-1",
    match_number: 1,
    stage: "group",
    group_letter: "A",
    kickoff_at: new Date(Date.now() + PICK_REMINDER_MINUTES * 60_000).toISOString(),
    venue: null,
    city: null,
    home_team_id: "home",
    away_team_id: "away",
    home_label: "USA",
    away_label: "Mexico",
    status: "scheduled",
    home_score: null,
    away_score: null,
    winner_team_id: null,
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
  };
}

const now = Date.parse("2026-06-15T18:00:00.000Z");

assert.equal(
  isInPickReminderWindow("2026-06-15T18:15:00.000Z", now),
  true,
  "15 minutes before kickoff is in window"
);

assert.equal(
  isInPickReminderWindow("2026-06-15T18:30:00.000Z", now),
  false,
  "30 minutes before kickoff is outside window"
);

assert.equal(
  isInPickReminderWindow("2026-06-15T18:05:00.000Z", now),
  false,
  "5 minutes before kickoff is outside window"
);

assert.equal(minutesUntilKickoff("2026-06-15T18:15:00.000Z", now), 15);

const payload = buildPickReminderPayload(
  makeMatch({ kickoff_at: "2026-06-15T18:15:00.000Z" }),
  now
);
assert.match(payload.body, /USA vs Mexico/);
assert.equal(payload.tag, "pick-reminder-match-1");

const reminder = findPickReminderForPlayer(
  [makeMatch({ kickoff_at: "2026-06-15T18:15:00.000Z" })],
  [],
  now
);
assert.ok(reminder, "missing pick should trigger reminder");

const noReminder = findPickReminderForPlayer(
  [makeMatch({ kickoff_at: "2026-06-15T18:15:00.000Z" })],
  [
    {
      id: "pred-1",
      player_id: "player-1",
      match_id: "match-1",
      pred_home_score: 2,
      pred_away_score: 1,
      pred_winner_team_id: "home",
      pick_confirmed: true,
      points: 0,
      exact_score: false,
      correct_result: false,
    },
  ],
  now
);
assert.equal(noReminder, null, "confirmed pick should not trigger reminder");

console.log("pickReminders.test.ts: all assertions passed");
