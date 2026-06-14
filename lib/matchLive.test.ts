import { describe, expect, it } from "vitest";
import {
  isAnyMatchNeedingScoreSync,
  matchNeedsScoreSync,
  shouldAutoFinalizeMatch,
} from "./matchLive";
import type { Match } from "./types";

function baseMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    match_number: 6,
    stage: "group",
    group_letter: "D",
    kickoff_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    venue: "Test",
    city: null,
    home_team_id: "home",
    away_team_id: "away",
    home_label: "Australia",
    away_label: "Türkiye",
    status: "locked",
    home_score: 1,
    away_score: 0,
    winner_team_id: "home",
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
    ...overrides,
  } as Match;
}

describe("matchNeedsScoreSync", () => {
  it("keeps syncing locked matches after the 2.5h in-play window", () => {
    const match = baseMatch();
    expect(matchNeedsScoreSync(match)).toBe(true);
    expect(isAnyMatchNeedingScoreSync([match])).toBe(true);
  });

  it("does not sync final matches", () => {
    const match = baseMatch({ status: "final" });
    expect(matchNeedsScoreSync(match)).toBe(false);
  });

  it("flags stale locked matches for auto-finalize only after in-play window", () => {
    const match = baseMatch();
    expect(shouldAutoFinalizeMatch(match)).toBe(true);
  });
});
