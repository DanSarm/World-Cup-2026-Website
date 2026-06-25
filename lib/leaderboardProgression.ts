import { format, parseISO } from "date-fns";
import type {
  ActualTournamentResults,
  FinalsChallengePrediction,
  LeaderboardEntry,
  ManualAdjustment,
  Match,
  MatchPrediction,
  Player,
  Settings,
  Team,
  TournamentPodiumPrediction,
} from "./types";
import { isMatchDecidedForScoring } from "./matchLive";
import { assignCompetitionRanksImmutable } from "./competitionRank";
import { calculateLeaderboard } from "./scoring";
import { matchDateKey } from "./utils";

export interface ProgressionSnapshotPlayer {
  playerId: string;
  displayName: string;
  points: number;
  rank: number;
}

export interface ProgressionSnapshot {
  id: string;
  label: string;
  entries: ProgressionSnapshotPlayer[];
}

export interface LeaderboardProgression {
  snapshots: ProgressionSnapshot[];
}

function compareMatchesChronologically(a: Match, b: Match): number {
  const ka = a.kickoff_at ?? "";
  const kb = b.kickoff_at ?? "";
  if (ka !== kb) return ka.localeCompare(kb);
  return a.match_number - b.match_number;
}

function maskUndecidedMatches(
  allMatches: Match[],
  decidedIds: Set<string>
): Match[] {
  return allMatches.map((m) => {
    if (decidedIds.has(m.id)) return m;
    return {
      ...m,
      status: "scheduled" as const,
      home_score: null,
      away_score: null,
      winner_team_id: null,
    };
  });
}

function snapshotFromLeaderboard(
  id: string,
  label: string,
  entries: LeaderboardEntry[]
): ProgressionSnapshot {
  return {
    id,
    label,
    entries: entries.map((e) => ({
      playerId: e.playerId,
      displayName: e.displayName,
      points: e.totalPoints,
      rank: e.rank,
    })),
  };
}

function formatDayLabel(dateKey: string): string {
  return format(parseISO(dateKey), "MMM d");
}

function finalizedMatchIdsByDay(matches: Match[]): Array<{
  dateKey: string;
  matchIds: string[];
}> {
  const byDate = new Map<string, string[]>();

  for (const match of matches) {
    if (!isMatchDecidedForScoring(match)) continue;
    const date = matchDateKey(match.kickoff_at);
    if (!date || date === "tba") continue;
    const ids = byDate.get(date) ?? [];
    ids.push(match.id);
    byDate.set(date, ids);
  }

  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, matchIds]) => ({
      dateKey,
      matchIds: matchIds.sort((a, b) => {
        const ma = matches.find((m) => m.id === a);
        const mb = matches.find((m) => m.id === b);
        if (!ma || !mb) return 0;
        return compareMatchesChronologically(ma, mb);
      }),
    }));
}

export function buildLeaderboardProgression(
  players: Player[],
  matches: Match[],
  predictions: MatchPrediction[],
  podiumPredictions: TournamentPodiumPrediction[],
  finalsPredictions: FinalsChallengePrediction[],
  adjustments: ManualAdjustment[],
  settings: Settings,
  actualResults: ActualTournamentResults,
  teams: Team[]
): LeaderboardProgression {
  const emptyPrizes = new Map<string, number>();
  const decidedIds = new Set<string>();
  const snapshots: ProgressionSnapshot[] = [];

  const runLeaderboard = () =>
    calculateLeaderboard(
      players,
      maskUndecidedMatches(matches, decidedIds),
      predictions,
      podiumPredictions,
      finalsPredictions,
      adjustments,
      settings,
      actualResults,
      emptyPrizes,
      teams,
      { includeLiveScores: false }
    );

  snapshots.push(snapshotFromLeaderboard("start", "Start", runLeaderboard()));

  for (const day of finalizedMatchIdsByDay(matches)) {
    for (const id of day.matchIds) decidedIds.add(id);
    snapshots.push(
      snapshotFromLeaderboard(
        `day-${day.dateKey}`,
        formatDayLabel(day.dateKey),
        runLeaderboard()
      )
    );
  }

  const datedIds = new Set(
    finalizedMatchIdsByDay(matches).flatMap((d) => d.matchIds)
  );
  const undated = matches
    .filter((m) => isMatchDecidedForScoring(m) && !datedIds.has(m.id))
    .sort(compareMatchesChronologically);

  for (const match of undated) {
    decidedIds.add(match.id);
    snapshots.push(
      snapshotFromLeaderboard(
        `m-${match.match_number}`,
        `M${match.match_number}`,
        runLeaderboard()
      )
    );
  }

  return { snapshots };
}

/** Restrict progression to a player subset and re-rank within each snapshot. */
export function filterProgressionForPlayers(
  progression: LeaderboardProgression,
  playerIds: Set<string>
): LeaderboardProgression {
  return {
    snapshots: progression.snapshots.map((snap) => {
      const subset = snap.entries.filter((e) => playerIds.has(e.playerId));
      const reranked = assignCompetitionRanksImmutable(
        subset.map((e) => ({ ...e, rank: 0 })),
        (e) => e.points
      );
      return {
        ...snap,
        entries: reranked.map((e) => ({
          playerId: e.playerId,
          displayName: e.displayName,
          points: e.points,
          rank: e.rank,
        })),
      };
    }),
  };
}
