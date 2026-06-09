import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getLiveSnapshot } from "@/lib/data";
import { isMatchLive } from "@/lib/matchLive";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getLiveSnapshot();
    const liveMatch = snapshot.liveMatch;

    return NextResponse.json({
      syncedAt: snapshot.sync.syncedAt,
      syncSkipped: snapshot.sync.skipped ?? null,
      hasLiveScoring: snapshot.hasLiveScoring,
      liveMatch: liveMatch
        ? {
            id: liveMatch.id,
            status: liveMatch.status,
            home_score: liveMatch.home_score,
            away_score: liveMatch.away_score,
            winner_team_id: liveMatch.winner_team_id,
            live_updated_at: liveMatch.live_updated_at,
            kickoff_at: liveMatch.kickoff_at,
            stage: liveMatch.stage,
            group_letter: liveMatch.group_letter,
            home_team_id: liveMatch.home_team_id,
            away_team_id: liveMatch.away_team_id,
          }
        : null,
      leaderboard: snapshot.leaderboard.map((entry) => ({
        playerId: entry.playerId,
        displayName: entry.displayName,
        avatarEmoji: entry.avatarEmoji,
        rank: entry.rank,
        totalPoints: entry.totalPoints,
        provisionalTotalPoints: entry.provisionalTotalPoints,
        livePoints: entry.livePoints,
        exactScores: entry.exactScores,
        picksMade: entry.picksMade,
        podiumPicks: entry.podiumPicks,
        recentForm: entry.recentForm,
      })),
      matches: snapshot.matches
        .filter((m) => isMatchLive(m) || m.status === "final")
        .map((m) => ({
          id: m.id,
          status: m.status,
          home_score: m.home_score,
          away_score: m.away_score,
          winner_team_id: m.winner_team_id,
          live_updated_at: m.live_updated_at,
        })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Live sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
