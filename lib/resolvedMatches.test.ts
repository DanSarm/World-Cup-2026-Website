import { resolveMatchesForPicks } from "./resolvedMatches";
import type { Match, Team } from "./types";

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
  away: Team,
  status: Match["status"] = "final",
  homeScore = 1,
  awayScore = 0
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
    status,
    home_score: homeScore,
    away_score: awayScore,
    winner_team_id: homeScore === awayScore ? null : homeScore > awayScore ? home.id : away.id,
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

function koMatch(num: number): Match {
  return {
    id: `ko-${num}`,
    match_number: num,
    stage: "round_of_32",
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
  groupMatch("a1", 1, "A", mex, rsa, "locked", 2, 0),
  groupMatch("a2", 2, "A", kor, cze, "locked", 1, 0),
  groupMatch("a3", 25, "A", cze, rsa, "locked", 3, 0),
  groupMatch("a4", 26, "A", mex, kor, "locked", 2, 1),
  groupMatch("b1", 3, "B", can, bih, "locked", 1, 0),
  groupMatch("b2", 8, "B", qat, sui, "locked", 0, 1),
  groupMatch("b3", 51, "B", sui, can, "locked", 2, 0),
  groupMatch("b4", 52, "B", bih, qat, "locked", 1, 0),
];

const koMatches = Array.from({ length: 16 }, (_, i) => koMatch(73 + i));

const lockedResolved = resolveMatchesForPicks([...groupMatches, ...koMatches]);
const m73Locked = lockedResolved.find((m) => m.match_number === 73);
assert(!!m73Locked, "R32 group-vs-group match appears when groups are locked");
assert(
  m73Locked?.home_team?.fifa_code === "CZE",
  "locked R32 home team resolves from standings"
);
assert(
  m73Locked?.away_team?.fifa_code === "BIH",
  "locked R32 away team resolves from standings"
);

const usa = team("USA", "D");
const par = team("PAR", "D");
const aus = team("AUS", "D");
const tur = team("TUR", "D");

const groupDMatches: Match[] = [
  groupMatch("d1", 4, "D", usa, par, "locked", 2, 0),
  groupMatch("d2", 32, "D", usa, aus, "locked", 1, 0),
  groupMatch("d3", 59, "D", tur, usa, "locked", 0, 2),
];

const m81 = {
  ...koMatch(81),
  home_team_id: usa.id,
  away_team_id: bih.id,
  home_team: usa,
  away_team: bih,
  home_label: usa.name,
  away_label: bih.name,
};

const preserved = resolveMatchesForPicks([
  ...groupMatches,
  ...groupDMatches,
  ...koMatches.map((m) => (m.match_number === 81 ? m81 : m)),
]);
const m81Pick = preserved.find((m) => m.match_number === 81);
assert(!!m81Pick, "pre-assigned USA vs Bosnia knockout match stays on picks");
assert(m81Pick?.home_team?.fifa_code === "USA", "USA preserved as home");
assert(m81Pick?.away_team?.fifa_code === "BIH", "Bosnia preserved as away");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
