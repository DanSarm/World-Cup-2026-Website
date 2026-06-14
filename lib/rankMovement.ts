import { isMatchDecidedForScoring } from "./matchLive";
import type { Match } from "./types";

/** Most recently played match with a scoreable result. */
export function findLatestDecidedMatch(matches: Match[]): Match | null {
  const decided = matches.filter(
    (m) => isMatchDecidedForScoring(m) && m.kickoff_at
  );
  if (!decided.length) return null;

  return [...decided].sort((a, b) => {
    const byKickoff = (b.kickoff_at ?? "").localeCompare(a.kickoff_at ?? "");
    if (byKickoff !== 0) return byKickoff;
    return b.match_number - a.match_number;
  })[0];
}

/** Strip one match's result so the leaderboard reflects the prior state. */
export function revertMatchForScoring(match: Match): Match {
  return {
    ...match,
    status: "scheduled",
    home_score: null,
    away_score: null,
    winner_team_id: null,
  };
}

export type RankMovement = "up" | "down" | "same";

export function rankMovementFromRanks(
  beforeRank: number | undefined,
  afterRank: number | undefined
): RankMovement {
  if (
    beforeRank == null ||
    afterRank == null ||
    beforeRank === afterRank
  ) {
    return "same";
  }
  return beforeRank > afterRank ? "up" : "down";
}
