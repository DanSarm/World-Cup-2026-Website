import {
  scoreMatchPrediction,
  calculatePerfectDayBonuses,
  calculateBigPredictionPoints,
  calculatePodiumPoints,
} from "./scoring";
import {
  calculateTeamTournamentValue,
  tournamentPlacePoints,
  pickRiskLabel,
  formatMarketWinPercent,
  estimateWinPercentageFromRank,
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

const bonuses = calculatePerfectDayBonuses(dayMatches, dayPreds, ["player1"]);
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

// ── Tournament Picks: market-based dynamic points ──

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
assert(
  calculateTeamTournamentValue(marketTeam("mar", 1.6)) === 63,
  "Morocco 1.6% → value 63"
);
assert(
  calculateTeamTournamentValue(marketTeam("hai", 0.4)) === 250,
  "Haiti 0.4% → value 250 (capped)"
);
assert(
  calculateTeamTournamentValue(marketTeam("esp", 25)) === 5,
  "Heavy favorite clamps to value 5"
);
assert(
  calculateTeamTournamentValue(marketTeam("xxx", null)) === 0,
  "Missing market % → value 0"
);
assert(
  calculateTeamTournamentValue(marketTeam("ovr", 14, 100)) === 100,
  "Override beats computed value"
);

assert(
  tournamentPlacePoints(marketTeam("fra", 14), "champion") === 7 &&
    tournamentPlacePoints(marketTeam("fra", 14), "runnerUp") === 3 &&
    tournamentPlacePoints(marketTeam("fra", 14), "thirdPlace") === 2,
  "France champion 7 / runner-up 3 / third 2"
);
assert(
  tournamentPlacePoints(marketTeam("mar", 1.6), "champion") === 63 &&
    tournamentPlacePoints(marketTeam("mar", 1.6), "runnerUp") === 28 &&
    tournamentPlacePoints(marketTeam("mar", 1.6), "thirdPlace") === 19,
  "Morocco champion 63 / runner-up 28 / third 19"
);
assert(
  tournamentPlacePoints(marketTeam("hai", 0.4), "runnerUp") === 113 &&
    tournamentPlacePoints(marketTeam("hai", 0.4), "thirdPlace") === 75,
  "Haiti runner-up 113 / third 75"
);

assert(
  pickRiskLabel(7).label === "Safe pick" &&
    pickRiskLabel(28).label === "Brave pick" &&
    pickRiskLabel(63).label === "Longshot" &&
    pickRiskLabel(250).label === "Miracle",
  "risk labels by points band"
);

assert(
  formatMarketWinPercent({ market_win_percentage: 0.4, market_label: "<1%" }) === "<1%" &&
    formatMarketWinPercent({ market_win_percentage: 14, market_label: null }) === "14%" &&
    formatMarketWinPercent({ market_win_percentage: 8.9, market_label: null }) === "8.9%",
  "market % display formatting"
);

assert(
  estimateWinPercentageFromRank(20) === 0.8 &&
    estimateWinPercentageFromRank(28) === 0.5 &&
    estimateWinPercentageFromRank(40) === 0.4,
  "rank-band win % estimates"
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

const podiumWrongOrder = calculatePodiumPoints(
  {
    first_place_team_id: "fra",
    second_place_team_id: "mar",
    third_place_team_id: "hai",
  },
  { champion: "mar", runner_up: "fra", third_place: "qat" },
  podiumTeams
);
assert(
  podiumWrongOrder.total === 0,
  "no points unless exact position is correct"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
