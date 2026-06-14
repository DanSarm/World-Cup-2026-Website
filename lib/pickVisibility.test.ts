import assert from "node:assert/strict";
import {
  canRevealOtherPlayersPicks,
  filterCommunityPicksForViewer,
} from "./pickVisibility";
import type { CommunityMatchPick } from "./data";
import type { Match } from "./types";

const baseMatch: Match = {
  id: "m1",
  match_number: 1,
  stage: "group",
  group_letter: "A",
  home_team_id: "h1",
  away_team_id: "a1",
  home_label: "Home",
  away_label: "Away",
  kickoff_at: "2099-06-15T18:00:00Z",
  status: "scheduled",
  home_score: null,
  away_score: null,
  winner_team_id: null,
};

function pick(playerId: string): CommunityMatchPick {
  return {
    playerId,
    displayName: playerId,
    avatarEmoji: "⚽",
    predHomeScore: 1,
    predAwayScore: 0,
    predWinnerTeamId: null,
    podiumPicks: null,
  };
}

assert.equal(
  canRevealOtherPlayersPicks(baseMatch),
  false,
  "scheduled future match hides picks"
);

assert.equal(
  canRevealOtherPlayersPicks({ ...baseMatch, status: "final", home_score: 2, away_score: 1 }),
  true,
  "final match reveals picks"
);

assert.equal(
  canRevealOtherPlayersPicks({
    ...baseMatch,
    status: "live",
    kickoff_at: "2020-06-15T18:00:00Z",
    home_score: 0,
    away_score: 0,
  }),
  true,
  "live match reveals picks"
);

assert.equal(
  canRevealOtherPlayersPicks({
    ...baseMatch,
    kickoff_at: "2020-06-15T18:00:00Z",
    status: "scheduled",
    home_score: null,
    away_score: null,
  }),
  true,
  "kickoff passed reveals picks even before live sync"
);

const filtered = filterCommunityPicksForViewer(
  [pick("alice"), pick("bob")],
  baseMatch,
  "alice"
);
assert.equal(filtered.length, 1, "only viewer pick kept before kickoff");
assert.equal(filtered[0]?.playerId, "alice");

const revealed = filterCommunityPicksForViewer(
  [pick("alice"), pick("bob")],
  { ...baseMatch, status: "final", home_score: 1, away_score: 0 },
  "alice"
);
assert.equal(revealed.length, 2, "all picks shown after reveal");

console.log("pickVisibility.test.ts: all passed");
