import assert from "node:assert/strict";
import { computePlayerAchievements } from "./playerProfile";
import type { LeaderboardEntry } from "./types";
import type { PoolHighlights } from "./poolHighlights";
import { DEFAULT_SCORING_CONFIG } from "./scoringConfig";

const baseEntry = {
  playerId: "p1",
  displayName: "Nico",
  avatarEmoji: "⚽",
  paid: true,
  rank: 4,
  totalPoints: 42,
  exactScores: 2,
  correctResults: 5,
  picksMade: 10,
  projectedPrize: 0,
  prizeLabel: "Projected" as const,
  podiumPicks: null,
  recentForm: [],
} as LeaderboardEntry;

const poolHighlights: PoolHighlights = {
  currentLeader: { icon: "👑", title: "Leader", headline: "Someone", detail: "50 pts" },
  exactKing: null,
  miracleMaker: null,
  biggestClimber: null,
  bestPick: null,
  perfectDayClub: {
    icon: "⭐",
    title: "Perfect Day Club",
    headline: "Nico, Alex, Sam",
    detail: "1 perfect day · 1 perfect day · 1 perfect day",
  },
  chaosPick: null,
};

const achievements = computePlayerAchievements(baseEntry, poolHighlights, 1);

const perfectDay = achievements.find((a) => a.id === "perfect-day-club");
assert.ok(perfectDay, "earns perfect day club");
assert.equal(perfectDay?.stat, "1× perfect");
assert.equal(
  perfectDay?.subtitle,
  "Every pick correct on a busy day",
  "no pool-wide repeated detail"
);
assert.ok(
  !JSON.stringify(achievements).includes("1 perfect day · 1 perfect day"),
  "never repeats pool highlight blob"
);

console.log("playerProfile achievements test: passed");
