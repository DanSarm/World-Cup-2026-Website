import {
  scoreMatchPrediction,
  calculatePerfectDayBonuses,
  calculatePerfectDayCounts,
  countPerfectDays,
  calculateBigPredictionPoints,
  calculatePodiumPoints,
} from "./scoring";
import {
  calculateTeamTournamentValue,
} from "./tournamentValue";
import type { Match, MatchPrediction, Team } from "./types";

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
  }).points === 8,
  "exact score group match = 8"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 1, away_score: 0 },
    { pred_home_score: 2, pred_away_score: 1, pred_winner_team_id: null }
  ).points === 3,
  "correct winner, two goals off = 3"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 3, away_score: 1 },
    { pred_home_score: 2, pred_away_score: 1, pred_winner_team_id: null }
  ).points === 3,
  "correct winner, one goal off = 3"
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
  "non-exact draw, two goals off = 3"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 2, away_score: 0, home_win_bonus: 0, draw_bonus: 4, away_win_bonus: 6 },
    { pred_home_score: 2, pred_away_score: 0, pred_winner_team_id: null }
  ).points === 8,
  "favorite home win exact with 0 bonus = 8"
);

assert(
  scoreMatchPrediction(
    { ...groupMatch, home_score: 1, away_score: 1, home_win_bonus: 0, draw_bonus: 4, away_win_bonus: 6 },
    { pred_home_score: 1, pred_away_score: 1, pred_winner_team_id: null }
  ).points === 12,
  "exact draw with draw bonus 4 = 12"
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
  ).points === 16,
  "away underdog exact 1-0 with away win bonus 6 = 16"
);

// Mexico 2-0 examples (home win bonus 0)
const mexicoMatch: Match = {
  ...groupMatch,
  home_team_id: "mex",
  away_team_id: "rsa",
  home_score: 2,
  away_score: 0,
  home_win_bonus: 0,
  away_win_bonus: 0,
  draw_bonus: 0,
};

const mexPick = (h: number, a: number) =>
  scoreMatchPrediction(mexicoMatch, {
    pred_home_score: h,
    pred_away_score: a,
    pred_winner_team_id: null,
  }).points;

assert(mexPick(2, 0) === 8, "Mexico 2-0 exact = 8");
assert(mexPick(3, 0) === 3, "Mexico 3-0 correct result only = 3");
assert(mexPick(2, 1) === 3, "Mexico 2-1 correct result only = 3");
assert(mexPick(1, 0) === 3, "Mexico 1-0 correct result only = 3");
assert(mexPick(3, 1) === 3, "Mexico 3-1 correct result only = 3");
assert(mexPick(4, 2) === 3, "Mexico 4-2 correct result only = 3");
assert(mexPick(1, 1) === 0, "Mexico 1-1 wrong result = 0");
assert(mexPick(0, 1) === 0, "Mexico 0-1 wrong result = 0");

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
  }).points === 15,
  "knockout correct advancing team + exact score = 15"
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
  ).points === 23,
  "knockout away advance + exact + bonus 6 + fire 2 = 23"
);

assert(
  scoreMatchPrediction(
    { ...koMatch, home_score: 2, away_score: 0, winner_team_id: "bra" },
    {
      pred_home_score: 3,
      pred_away_score: 0,
      pred_winner_team_id: "bra",
    }
  ).points === 10,
  "knockout correct advancer non-exact = 10"
);

assert(
  scoreMatchPrediction(
    {
      ...koMatch,
      stage: "round_of_32",
      home_score: 0,
      away_score: 1,
      winner_team_id: "can",
      home_team_id: "rsa",
      away_team_id: "can",
    },
    {
      pred_home_score: 0,
      pred_away_score: 2,
      pred_winner_team_id: null,
    }
  ).points === 4,
  "knockout infers away advancer from score when pred_winner is null"
);

assert(
  scoreMatchPrediction(
    { ...koMatch, home_score: 2, away_score: 0, winner_team_id: "bra" },
    {
      pred_home_score: 2,
      pred_away_score: 0,
      pred_winner_team_id: "mar",
    }
  ).points === 0,
  "knockout wrong advancer = 0 even if score close"
);

const dayMatches: Match[] = [
  {
    ...groupMatch,
    id: "m1",
    status: "final",
    kickoff_at: "2026-06-13T18:00:00Z",
    home_score: 2,
    away_score: 1,
  },
  {
    ...groupMatch,
    id: "m2",
    status: "final",
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
    pick_confirmed: true,
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
    pick_confirmed: true,
    points: 0,
    exact_score: false,
    correct_result: false,
  },
];

const perfectDayCounts = calculatePerfectDayCounts(dayMatches, dayPreds, ["player1"]);
assert(
  perfectDayCounts.get("player1") === 1,
  "one perfect day when all picks correct on a two-match day"
);
assert(
  countPerfectDays(dayMatches, dayPreds, "player1") === 1,
  "countPerfectDays matches batch helper"
);
assert(
  calculatePerfectDayBonuses(dayMatches, dayPreds, ["player1"]).size === 0,
  "perfect day no longer awards bonus points"
);

assert(
  calculateBigPredictionPoints(
    { group_winners: {}, group_runners_up: {}, semifinalists: [], finalists: [], champion_team_id: "jpn", top_scorer: null },
    { champion: "jpn" },
    { jpn: 0.04 }
  ) === 35,
  "champion + longshot bonus = 35"
);

const marketTeam = (
  id: string,
  pct: number | null,
  override: number | null = null
): Team => ({
  id,
  name: id,
  short_name: id,
  fifa_code: id.toUpperCase(),
  flag_emoji: "🏳️",
  group_letter: null,
  market_win_percentage: pct,
  tournament_value_override: override,
});

assert(
  calculateTeamTournamentValue(marketTeam("fra", 14)) === 7,
  "France 14% → value 7"
);

const podiumTeams = new Map<string, Team>([
  ["fra", marketTeam("fra", 14)],
  ["mar", marketTeam("mar", 1.6)],
  ["hai", marketTeam("hai", 0.4)],
]);

const podiumBreakdown = calculatePodiumPoints(
  {
    first_place_team_id: "mar",
    second_place_team_id: "fra",
    third_place_team_id: "hai",
  },
  { champion: "mar", runner_up: "fra", third_place: "hai" },
  podiumTeams
);
assert(
  podiumBreakdown.champion === 63 &&
    podiumBreakdown.runnerUp === 3 &&
    podiumBreakdown.thirdPlace === 75 &&
    podiumBreakdown.total === 141,
  "podium breakdown: all exact positions correct"
);

const podiumPartial = calculatePodiumPoints(
  {
    first_place_team_id: "fra",
    second_place_team_id: "mar",
    third_place_team_id: "hai",
  },
  { champion: "mar", runner_up: "fra", third_place: "qat" },
  podiumTeams
);
assert(
  podiumPartial.champion === 2 &&
    podiumPartial.runnerUp === 16 &&
    podiumPartial.thirdPlace === 0 &&
    podiumPartial.total === 18,
  "podium partial credit for near-miss picks"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
