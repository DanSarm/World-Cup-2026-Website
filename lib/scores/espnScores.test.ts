import { matchEspnEventToFixture, type EspnScoreEvent } from "./espnScores";
import type { Match, Team } from "../types";

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

const kor: Team = {
  id: "kor",
  name: "Korea Republic",
  short_name: "Korea",
  fifa_code: "KOR",
  flag_emoji: "🇰🇷",
  group_letter: "A",
};

const cze: Team = {
  id: "cze",
  name: "Czechia",
  short_name: "Czechia",
  fifa_code: "CZE",
  flag_emoji: "🇨🇿",
  group_letter: "A",
};

function match(home: Team, away: Team): Match {
  return {
    id: "m1",
    match_number: 2,
    stage: "group",
    group_letter: "A",
    kickoff_at: "2026-06-12T02:00:00Z",
    venue: "Test",
    city: null,
    home_team_id: home.id,
    away_team_id: away.id,
    home_team: home,
    away_team: away,
    home_label: home.name,
    away_label: away.name,
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
  };
}

const events: EspnScoreEvent[] = [
  {
    id: "1",
    homeTeam: "South Korea",
    awayTeam: "Czechia",
    homeScore: 2,
    awayScore: 1,
    completed: true,
    inProgress: false,
    liveClockDisplay: null,
  },
];

assert(
  matchEspnEventToFixture(events, match(kor, cze))?.homeScore === 2,
  "South Korea maps to Korea Republic home score"
);
assert(
  matchEspnEventToFixture(events, match(kor, cze))?.awayScore === 1,
  "South Korea maps to Korea Republic away score"
);

const flipped = matchEspnEventToFixture(events, match(cze, kor));
assert(flipped?.homeScore === 1, "reversed fixture flips home score");
assert(flipped?.awayScore === 2, "reversed fixture flips away score");

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} tests passed.`);
