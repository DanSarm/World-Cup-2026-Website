import { describe, expect, it } from "vitest";
import {
  findLatestDecidedMatch,
  rankMovementFromRanks,
  revertMatchForScoring,
} from "./rankMovement";
import type { Match } from "./types";

function match(partial: Partial<Match> & Pick<Match, "match_number">): Match {
  return {
    id: `m-${partial.match_number}`,
    stage: "group",
    group_letter: "A",
    kickoff_at: "2026-06-10T20:00:00Z",
    venue: "Test",
    city: null,
    home_team_id: "h",
    away_team_id: "a",
    home_label: "Home",
    away_label: "Away",
    status: "final",
    home_score: 1,
    away_score: 0,
    winner_team_id: "h",
    live_updated_at: null,
    live_clock_display: null,
    decided_by_penalties: false,
    home_win_bonus: 0,
    draw_bonus: 0,
    away_win_bonus: 0,
    home_implied_probability: null,
    draw_implied_probability: null,
    away_implied_probability: null,
    home_advance_bonus: null,
    away_advance_bonus: null,
    odds_event_id: null,
    ...partial,
  } as Match;
}

describe("findLatestDecidedMatch", () => {
  it("returns the match with the latest kickoff", () => {
    const older = match({
      match_number: 1,
      kickoff_at: "2026-06-10T20:00:00Z",
      status: "final",
    });
    const latest = match({
      match_number: 6,
      kickoff_at: "2026-06-14T04:00:00Z",
      status: "final",
    });
    const scheduled = match({
      match_number: 7,
      kickoff_at: "2026-06-15T04:00:00Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    });

    expect(findLatestDecidedMatch([older, latest, scheduled])).toEqual(latest);
  });

  it("ignores undecided matches", () => {
    const decided = match({ match_number: 2, status: "final" });
    const upcoming = match({
      match_number: 99,
      kickoff_at: "2026-12-01T00:00:00Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    });
    expect(findLatestDecidedMatch([decided, upcoming])).toEqual(decided);
  });
});

describe("rankMovementFromRanks", () => {
  it("marks upward movement when rank number improves", () => {
    expect(rankMovementFromRanks(4, 3)).toBe("up");
  });

  it("marks downward movement when rank number worsens", () => {
    expect(rankMovementFromRanks(4, 5)).toBe("down");
  });

  it("marks no movement when rank is unchanged", () => {
    expect(rankMovementFromRanks(4, 4)).toBe("same");
  });
});

describe("revertMatchForScoring", () => {
  it("clears scores and resets status", () => {
    const reverted = revertMatchForScoring(
      match({ match_number: 1, status: "final", home_score: 2, away_score: 0 })
    );
    expect(reverted.status).toBe("scheduled");
    expect(reverted.home_score).toBeNull();
    expect(reverted.away_score).toBeNull();
    expect(reverted.winner_team_id).toBeNull();
  });
});
