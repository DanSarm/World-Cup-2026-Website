import {
  computeGroupProjections,
  getEffectivePickScore,
} from "./groupStandings";
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

const team = (code: string, id: string, group: string): Team => ({
  id,
  name: code,
  short_name: code,
  fifa_code: code,
  flag_emoji: "🏳",
  group_letter: group,
});

const mex = team("MEX", "mex", "A");
const rsa = team("RSA", "rsa", "A");

const match1: Match = {
  id: "m1",
  match_number: 1,
  stage: "group",
  group_letter: "A",
  kickoff_at: null,
  venue: null,
  city: null,
  home_team_id: mex.id,
  away_team_id: rsa.id,
  home_label: "Mexico",
  away_label: "South Africa",
  status: "scheduled",
  home_score: null,
  away_score: null,
  winner_team_id: null,
  decided_by_penalties: false,
  home_team: mex,
  away_team: rsa,
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

const picks = new Map([["m1", { home: 2, away: 0 }]]);
const groups = computeGroupProjections([match1], picks);
const groupA = groups.find((g) => g.letter === "A");

assert(Boolean(groupA), "group A exists");
assert(groupA?.rows[0]?.team.fifa_code === "MEX", "Mexico wins group on 2-0");
assert(groupA?.rows[0]?.points === 3, "winner has 3 pts");
assert(groupA?.rows[1]?.points === 0, "loser has 0 pts");

assert(
  getEffectivePickScore(
    { ...match1, status: "final", home_score: 1, away_score: 1 },
    { home: 2, away: 0 },
    { home: 3, away: 0 }
  )?.home === 1,
  "final score beats draft pick"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
