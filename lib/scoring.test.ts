import {
  scoreMatchPrediction,
  calculatePerfectDayBonuses,
  calculateBigPredictionPoints,
} from "./scoring";
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

const bonusDefaults = {
  home_win_bonus: 0,
  draw_bonus: 0,
  away_win_bonus: 0,
  home_advance_bonus: 0,
  away_advance_bonus: 0,
  odds_event_id: null,
  odds_last_synced_at: null,
  odds_locked_at: null,
  odds_status: "not_synced" as const,
  home_implied_probability: null,
  draw_implied_probability: null,
  away_implied_probability: null,
  home_advance_probability: null,
  away_advance_probability: null,
  odds_source_note: null,
};

const groupMatch: Match = {
  id: "1",
  match_number: 1,
  stage: "group",
  group_letter: "C",
  kickoff_at: "2026-06-13T00:00:00Z",
  venue: "Test",
  city: null,
  home_team_id: "bra",
  away_team_id: "mar",
  home_label: "Brazil",
  away_label: "Morocco",
  status: "final",
  home_score: 2,
  away_score: 1,
  winner_team_id: null,
  decided_by_penalties: false,
  ...bonusDefaults,
};

assert(
  scoreMatchPrediction(groupMatch, {
    pred_home_score: 2,
    pred_away_score: 1,
    pred_winner_team_id: null,
  }).points === 6,
  "exact score group match = 6"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 1, away_score: 0 },
    { pred_home_score: 2, pred_away_score: 1, pred_winner_team_id: null }
  ).points === 4,
  "correct winner and correct margin = 4"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 3, away_score: 1 },
    { pred_home_score: 2, pred_away_score: 1, pred_winner_team_id: null }
  ).points === 3,
  "correct winner only = 3"
);

assert(
  scoreMatchPrediction(groupMatch, {
    pred_home_score: 1,
    pred_away_score: 2,
    pred_winner_team_id: null,
  }).points === 0,
  "wrong result = 0"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 0, away_score: 0 },
    { pred_home_score: 1, pred_away_score: 1, pred_winner_team_id: null }
  ).points === 3,
  "non-exact draw = 3"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 2, away_score: 0, home_win_bonus: 0, draw_bonus: 4, away_win_bonus: 6 },
    { pred_home_score: 2, pred_away_score: 0, pred_winner_team_id: null }
  ).points === 6,
  "favorite home win exact with 0 bonus = 6"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 1, away_score: 1, home_win_bonus: 0, draw_bonus: 4, away_win_bonus: 6 },
    { pred_home_score: 1, pred_away_score: 1, pred_winner_team_id: null }
  ).points === 10,
  "exact draw with draw bonus 4 = 10"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 1, away_score: 1, home_win_bonus: 0, draw_bonus: 4, away_win_bonus: 6 },
    { pred_home_score: 0, pred_away_score: 0, pred_winner_team_id: null }
  ).points === 7,
  "correct draw non-exact with draw bonus = 7"
);

assert(
  scoreMatchPrediction(
    {
      ...groupMatch,
      home_team_id: "fra",
      away_team_id: "uzb",
      home_score: 0,
      away_score: 1,
      home_win_bonus: 0,
      draw_bonus: 4,
      away_win_bonus: 6,
    },
    { pred_home_score: 0, pred_away_score: 1, pred_winner_team_id: null }
  ).points === 14,
  "away underdog exact 1-0 with away win bonus 6 = 14"
);

const koMatch: Match = {
  ...groupMatch,
  stage: "final",
  home_score: 2,
  away_score: 1,
  winner_team_id: "bra",
  home_advance_bonus: 0,
  away_advance_bonus: 0,
};

assert(
  scoreMatchPrediction(koMatch, {
    pred_home_score: 2,
    pred_away_score: 1,
    pred_winner_team_id: "bra",
  }).points === 13,
  "knockout correct advancing team + exact score = 13"
);

assert(
  scoreMatchPrediction(
    {
      ...koMatch,
      home_score: 0,
      away_score: 1,
      winner_team_id: "mar",
      away_advance_bonus: 6,
    },
    {
      pred_home_score: 0,
      pred_away_score: 1,
      pred_winner_team_id: "mar",
    }
  ).points === 21,
  "knockout away advance + exact + bonus 6 + fire 2 = 21"
);

const dayMatches: Match[] = [
  {
    ...groupMatch,
    id: "m1",
    kickoff_at: "2026-06-13T18:00:00Z",
    home_score: 2,
    away_score: 1,
  },
  {
    ...groupMatch,
    id: "m2",
    kickoff_at: "2026-06-13T22:00:00Z",
    home_score: 1,
    away_score: 0,
  },
];

const dayPreds: MatchPrediction[] = [
  {
    id: "p1",
    player_id: "player1",
    match_id: "m1",
    pred_home_score: 2,
    pred_away_score: 1,
    pred_winner_team_id: null,
    points: 0,
    exact_score: false,
    correct_result: false,
  },
  {
    id: "p2",
    player_id: "player1",
    match_id: "m2",
    pred_home_score: 1,
    pred_away_score: 0,
    pred_winner_team_id: null,
    points: 0,
    exact_score: false,
    correct_result: false,
  },
];

const bonuses = calculatePerfectDayBonuses(dayMatches, dayPreds);
assert(
  bonuses.get("player1") === 5,
  "perfect day bonus +5"
);

assert(
  calculateBigPredictionPoints(
    { group_winners: {}, group_runners_up: {}, semifinalists: [], finalists: [], champion_team_id: "jpn", top_scorer: null },
    { champion: "jpn" },
    { jpn: 0.04 }
  ) === 35,
  "champion + longshot bonus = 35"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
