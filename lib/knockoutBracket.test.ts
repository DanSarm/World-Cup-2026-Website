import { buildKnockoutBracket } from "./knockoutBracket";
import type { PickScore } from "./groupStandings";
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

function team(code: string, letter: string): Team {
  return {
    id: code.toLowerCase(),
    name: code,
    short_name: code,
    fifa_code: code,
    flag_emoji: "",
    group_letter: letter,
  };
}

function groupMatch(
  id: string,
  num: number,
  letter: string,
  home: Team,
  away: Team
): Match {
  return {
    id,
    match_number: num,
    stage: "group",
    group_letter: letter,
    kickoff_at: null,
    venue: null,
    city: null,
    home_team_id: home.id,
    away_team_id: away.id,
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
    home_team: home,
    away_team: away,
  };
}

function koMatch(num: number, stage: Match["stage"]): Match {
  return {
    id: `ko-${num}`,
    match_number: num,
    stage,
    group_letter: null,
    kickoff_at: null,
    venue: null,
    city: null,
    home_team_id: null,
    away_team_id: null,
    home_label: "TBD",
    away_label: "TBD",
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
    home_team: null,
    away_team: null,
  };
}

const mex = team("MEX", "A");
const rsa = team("RSA", "A");
const kor = team("KOR", "A");
const cze = team("CZE", "A");
const can = team("CAN", "B");
const sui = team("SUI", "B");
const qat = team("QAT", "B");
const bih = team("BIH", "B");

const groupMatches: Match[] = [
  groupMatch("a1", 1, "A", mex, rsa),
  groupMatch("a2", 2, "A", kor, cze),
  groupMatch("a3", 25, "A", cze, rsa),
  groupMatch("a4", 26, "A", mex, kor),
  groupMatch("b1", 3, "B", can, bih),
  groupMatch("b2", 8, "B", qat, sui),
  groupMatch("b3", 51, "B", sui, can),
  groupMatch("b4", 52, "B", bih, qat),
];

const pickScores = new Map<string, PickScore>([
  ["a1", { home: 2, away: 0 }],
  ["a2", { home: 1, away: 0 }],
  ["a3", { home: 3, away: 0 }],
  ["a4", { home: 2, away: 1 }],
  ["b1", { home: 1, away: 0 }],
  ["b2", { home: 0, away: 1 }],
  ["b3", { home: 2, away: 0 }],
  ["b4", { home: 1, away: 0 }],
]);

const koMatches = Array.from({ length: 32 }, (_, i) =>
  koMatch(73 + i, i < 16 ? "round_of_32" : i < 24 ? "round_of_16" : i < 28 ? "quarterfinal" : i < 30 ? "semifinal" : i === 30 ? "third_place" : "final")
);

const bracket = buildKnockoutBracket(
  [...groupMatches, ...koMatches],
  pickScores,
  []
);

assert(bracket.matches.length === 32, "builds all 32 knockout matches");
assert(!!bracket.byNumber.get(73)?.home.team, "M73 home resolved from groups");
assert(!!bracket.byNumber.get(73)?.away.team, "M73 away resolved from groups");
assert(
  bracket.byNumber.get(73)?.home.team?.team.fifa_code === "CZE",
  "M73 home is Group A runner-up"
);
assert(
  bracket.byNumber.get(73)?.away.team?.team.fifa_code === "BIH",
  "M73 away is Group B runner-up"
);
assert(
  bracket.byNumber.get(79)?.home.team?.team.fifa_code === "MEX",
  "M79 home is Group A winner"
);
assert(
  bracket.qualifyingThirdGroups.length === 2,
  "third-place list uses available groups"
);

const withKo = buildKnockoutBracket(
  [...groupMatches, ...koMatches],
  pickScores,
  [
    {
      id: "p1",
      player_id: "player",
      match_id: "ko-73",
      pred_home_score: 2,
      pred_away_score: 1,
      pred_winner_team_id: null,
      pick_confirmed: true,
      points: 0,
      exact_score: false,
      correct_result: false,
    },
  ]
);

const m90 = withKo.byNumber.get(90)!;
assert(m90.home.team?.team.fifa_code === "CZE", "M90 home is winner of M73");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
