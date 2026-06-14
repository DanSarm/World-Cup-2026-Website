import { parseISO } from "date-fns";
import { shouldPromoteScheduledMatchWithScores } from "./matchFinalize";

const pastKickoff = "2026-06-11T19:00:00Z";
const futureKickoff = "2026-12-01T19:00:00Z";
const now = parseISO("2026-06-14T22:00:00Z").getTime();
const teamId = "00000000-0000-0000-0000-000000000001";

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

ok(
  shouldPromoteScheduledMatchWithScores(
    {
      status: "scheduled",
      home_score: 2,
      away_score: 0,
      kickoff_at: pastKickoff,
      home_team_id: teamId,
    },
    now
  ),
  "scheduled + scores + past kickoff → promote"
);

ok(
  !shouldPromoteScheduledMatchWithScores(
    {
      status: "final",
      home_score: 2,
      away_score: 0,
      kickoff_at: pastKickoff,
      home_team_id: teamId,
    },
    now
  ),
  "already final"
);

ok(
  !shouldPromoteScheduledMatchWithScores(
    {
      status: "scheduled",
      home_score: null,
      away_score: null,
      kickoff_at: pastKickoff,
      home_team_id: teamId,
    },
    now
  ),
  "no scores yet"
);

ok(
  !shouldPromoteScheduledMatchWithScores(
    {
      status: "scheduled",
      home_score: 1,
      away_score: 1,
      kickoff_at: futureKickoff,
      home_team_id: teamId,
    },
    now
  ),
  "future kickoff"
);

console.log("matchFinalize tests passed");
