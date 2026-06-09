import { GROUP_LETTERS, type Match, type Team } from "./types";
import { getActualMatchScore } from "./matchResults";

export interface PickScore {
  home: number;
  away: number;
}

export interface GroupStandingRow {
  teamId: string;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  rank: number;
}

export interface GroupProjection {
  letter: string;
  rows: GroupStandingRow[];
  picksApplied: number;
  totalMatches: number;
}

function emptyRow(teamId: string, team: Team): Omit<GroupStandingRow, "rank"> {
  return {
    teamId,
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  };
}

function applyMatch(
  table: Map<string, Omit<GroupStandingRow, "rank">>,
  homeId: string,
  awayId: string,
  homeGoals: number,
  awayGoals: number
) {
  const home = table.get(homeId);
  const away = table.get(awayId);
  if (!home || !away) return;

  home.played++;
  away.played++;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.won++;
    home.points += 3;
    away.lost++;
  } else if (homeGoals < awayGoals) {
    away.won++;
    away.points += 3;
    home.lost++;
  } else {
    home.drawn++;
    away.drawn++;
    home.points += 1;
    away.points += 1;
  }

  home.goalDiff = home.goalsFor - home.goalsAgainst;
  away.goalDiff = away.goalsFor - away.goalsAgainst;
}

function sortRows(rows: Omit<GroupStandingRow, "rank">[]): GroupStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.fifa_code.localeCompare(b.team.fifa_code);
  });

  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

function teamFromMatch(
  match: Match,
  side: "home" | "away"
): { id: string; team: Team } | null {
  const id = side === "home" ? match.home_team_id : match.away_team_id;
  const team = side === "home" ? match.home_team : match.away_team;
  if (!id || !team) return null;
  return { id, team };
}

/** Effective score for standings: real results beat saved/draft picks. */
export function getEffectivePickScore(
  match: Match,
  saved?: PickScore | null,
  draft?: PickScore | null
): PickScore | null {
  const actual = getActualMatchScore(match);
  if (actual) return actual;
  if (draft) return draft;
  if (saved) return saved;
  return null;
}

/** Project group tables from group-stage match picks. */
export function computeGroupProjections(
  matches: Match[],
  pickScores: Map<string, PickScore>
): GroupProjection[] {
  const groupMatches = matches.filter(
    (m) => m.stage === "group" && m.group_letter
  );

  return GROUP_LETTERS.map((letter) => {
    const letterMatches = groupMatches.filter((m) => m.group_letter === letter);
    const table = new Map<string, Omit<GroupStandingRow, "rank">>();
    let picksApplied = 0;

    for (const match of letterMatches) {
      const home = teamFromMatch(match, "home");
      const away = teamFromMatch(match, "away");
      if (!home || !away) continue;

      if (!table.has(home.id)) table.set(home.id, emptyRow(home.id, home.team));
      if (!table.has(away.id)) table.set(away.id, emptyRow(away.id, away.team));

      const score = pickScores.get(match.id);
      if (!score) continue;

      picksApplied++;
      applyMatch(table, home.id, away.id, score.home, score.away);
    }

    return {
      letter,
      rows: sortRows([...table.values()]),
      picksApplied,
      totalMatches: letterMatches.length,
    };
  }).filter((g) => g.rows.length > 0);
}

export function buildPickScoreMap(
  matches: Match[],
  savedPredictions: Map<string, PickScore>,
  draftPredictions: Map<string, PickScore>
): Map<string, PickScore> {
  const result = new Map<string, PickScore>();

  for (const match of matches) {
    if (match.stage !== "group") continue;
    const score = getEffectivePickScore(
      match,
      savedPredictions.get(match.id),
      draftPredictions.get(match.id)
    );
    if (score) result.set(match.id, score);
  }

  return result;
}
