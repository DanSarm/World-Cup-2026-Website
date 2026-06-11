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
import { calculateLeaderboard, countPerfectDays, scoreMatchPrediction } from "./scoring";
import { scoringConfigFromSettings, previewPickRewards } from "./scoringConfig";
import { isMatchDecidedForScoring } from "./matchLive";
import { isConfirmedPick } from "./pickUtils";
import { canPickMatch, getTodayTomorrowKeys, matchDateKey } from "./utils";

export interface HighlightCard {
  icon: string;
  title: string;
  headline: string;
  detail: string | string[];
}

export interface PoolHighlights {
  currentLeader: HighlightCard;
  exactKing: HighlightCard | null;
  miracleMaker: HighlightCard | null;
  biggestClimber: HighlightCard | null;
  bestPick: HighlightCard | null;
  perfectDayClub: HighlightCard;
  chaosPick: HighlightCard | null;
}

export interface PoolHighlightsContext {
  players: Player[];
  matches: Match[];
  predictions: MatchPrediction[];
  settings: Settings;
  leaderboard: LeaderboardEntry[];
  podiumPredictions: TournamentPodiumPrediction[];
  finalsPredictions: FinalsChallengePrediction[];
  adjustments: ManualAdjustment[];
  actualResults: ActualTournamentResults;
  teams: Team[];
}

function describePickScoreline(
  match: Match,
  predHome: number,
  predAway: number
): string {
  const home = match.home_team?.short_name ?? match.home_label;
  const away = match.away_team?.short_name ?? match.away_label;

  if (predHome > predAway) return `${home} ${predHome}–${predAway}`;
  if (predAway > predHome) return `${away} ${predAway}–${predHome}`;
  return `${home} ${predHome}–${predAway} draw`;
}

function describeMatchTeams(match: Match): string {
  const home = match.home_team?.short_name ?? match.home_label;
  const away = match.away_team?.short_name ?? match.away_label;
  return `${home} vs ${away}`;
}

function stripDecidedMatches(matches: Match[]): Match[] {
  return matches.map((m) =>
    isMatchDecidedForScoring(m)
      ? {
          ...m,
          status: "scheduled" as const,
          home_score: null,
          away_score: null,
          winner_team_id: null,
        }
      : m
  );
}

function stripDecidedMatchesOnDate(matches: Match[], dateKey: string): Match[] {
  return matches.map((m) =>
    isMatchDecidedForScoring(m) && matchDateKey(m.kickoff_at) === dateKey
      ? {
          ...m,
          status: "scheduled" as const,
          home_score: null,
          away_score: null,
          winner_team_id: null,
        }
      : m
  );
}

function computeRankImprovements(
  ctx: PoolHighlightsContext,
  matches: Match[]
): Map<string, number> {
  const projectedPrizes = new Map(
    ctx.leaderboard.map((e) => [e.playerId, e.projectedPrize])
  );
  const baseline = calculateLeaderboard(
    ctx.players,
    matches,
    ctx.predictions,
    ctx.podiumPredictions,
    ctx.finalsPredictions,
    ctx.adjustments,
    ctx.settings,
    ctx.actualResults,
    projectedPrizes,
    ctx.teams
  );
  const baselineRank = new Map(baseline.map((e) => [e.playerId, e.rank]));
  const improvements = new Map<string, number>();

  for (const entry of ctx.leaderboard) {
    const prevRank = baselineRank.get(entry.playerId);
    if (prevRank != null) {
      improvements.set(entry.playerId, prevRank - entry.rank);
    }
  }

  return improvements;
}

function formatNames(names: string[]): string {
  return names.length > 0 ? names.join(", ") : "—";
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    unique.push(name);
  }
  return unique;
}

function formatUniqueNames(names: string[]): string {
  return formatNames(uniqueNames(names));
}

type PickHighlightRow = {
  playerName: string;
  match: Match;
  predHome: number;
  predAway: number;
  points: number;
};

function pickGroupKey(
  matchId: string,
  predHome: number,
  predAway: number
): string {
  return `${matchId}:${predHome}:${predAway}`;
}

function formatGroupedPickDetail(
  picks: PickHighlightRow[],
  formatPoints: (points: number) => string
): string[] {
  const groups = new Map<
    string,
    {
      match: Match;
      predHome: number;
      predAway: number;
      points: number;
      names: string[];
    }
  >();

  for (const pick of picks) {
    const key = pickGroupKey(pick.match.id, pick.predHome, pick.predAway);
    const group = groups.get(key);
    if (group) {
      if (!group.names.includes(pick.playerName)) {
        group.names.push(pick.playerName);
      }
    } else {
      groups.set(key, {
        match: pick.match,
        predHome: pick.predHome,
        predAway: pick.predAway,
        points: pick.points,
        names: [pick.playerName],
      });
    }
  }

  return [...groups.values()].map(
    (group) =>
      `${formatNames(group.names)} · ${describePickScoreline(group.match, group.predHome, group.predAway)} · ${describeMatchTeams(group.match)} · ${formatPoints(group.points)}`
  );
}

function pickAllAtTop(
  players: Player[],
  improvements: Map<string, number>
): { names: string[]; value: number } | null {
  let max = 0;
  for (const player of players) {
    const value = improvements.get(player.id) ?? 0;
    if (value > max) max = value;
  }
  if (max <= 0) return null;

  const names = players
    .filter((p) => (improvements.get(p.id) ?? 0) === max)
    .map((p) => p.display_name);

  return { names, value: max };
}

function pickBiggestClimber(
  ctx: PoolHighlightsContext
): HighlightCard | null {
  const hasDecided = ctx.matches.some((m) => isMatchDecidedForScoring(m));
  if (!hasDecided) return null;

  let improvements = computeRankImprovements(
    ctx,
    stripDecidedMatches(ctx.matches)
  );
  let scope: "tournament" | "today" | null = "tournament";

  let best = pickAllAtTop(ctx.players, improvements);
  if (!best) {
    const { today } = getTodayTomorrowKeys();
    const todayDecided = ctx.matches.some(
      (m) =>
        isMatchDecidedForScoring(m) && matchDateKey(m.kickoff_at) === today
    );
    if (!todayDecided) return null;

    improvements = computeRankImprovements(
      ctx,
      stripDecidedMatchesOnDate(ctx.matches, today)
    );
    best = pickAllAtTop(ctx.players, improvements);
    scope = best ? "today" : null;
  }

  if (!best || !scope) return null;

  return {
    icon: "📈",
    title: "Biggest Climber",
    headline: formatNames(best.names),
    detail:
      scope === "tournament"
        ? `Up ${best.value} place${best.value === 1 ? "" : "s"} since tournament start`
        : `Up ${best.value} place${best.value === 1 ? "" : "s"} today`,
  };
}

export function computePoolHighlights(
  ctx: PoolHighlightsContext
): PoolHighlights {
  const { players, matches, predictions, settings, leaderboard } = ctx;
  const scoringConfig = scoringConfigFromSettings(settings);
  const confirmed = predictions.filter(isConfirmedPick);

  const predsByPlayerMatch = new Map<string, MatchPrediction>();
  for (const pred of confirmed) {
    predsByPlayerMatch.set(`${pred.player_id}:${pred.match_id}`, pred);
  }

  const leaders = leaderboard.filter((e) => e.rank === 1);
  const leaderNames = formatNames(leaders.map((e) => e.displayName));
  const leaderPointValues = [
    ...new Set(
      leaders.map(
        (e) => e.provisionalTotalPoints ?? e.totalPoints
      )
    ),
  ];

  const currentLeader: HighlightCard = {
    icon: "👑",
    title: "Current Leader",
    headline: leaderNames,
    detail:
      leaders.length === 0
        ? "—"
        : leaderPointValues.length === 1
          ? `${leaderPointValues[0]} pts`
          : leaderPointValues.map((pts) => `${pts} pts`).join(", "),
  };

  const maxExact = Math.max(...leaderboard.map((e) => e.exactScores), 0);
  const exactKings = leaderboard.filter((e) => e.exactScores === maxExact);
  const exactKing =
    maxExact > 0
      ? {
          icon: "🎯",
          title: "Exact King",
          headline: formatNames(exactKings.map((e) => e.displayName)),
          detail: `${maxExact} exact score${maxExact === 1 ? "" : "s"}`,
        }
      : null;

  const maxMiracle = Math.max(...leaderboard.map((e) => e.miraclePoints), 0);
  const miracleMakers = leaderboard.filter((e) => e.miraclePoints === maxMiracle);
  const miracleMaker =
    maxMiracle > 0
      ? {
          icon: "🚀",
          title: "Miracle Maker",
          headline: formatNames(miracleMakers.map((e) => e.displayName)),
          detail: `${maxMiracle} miracle pts`,
        }
      : null;

  const biggestClimber = pickBiggestClimber(ctx);

  type ScoredPickHighlight = PickHighlightRow;

  const scoredPicks: ScoredPickHighlight[] = [];

  for (const match of matches.filter(isMatchDecidedForScoring)) {
    if (match.home_score === null || match.away_score === null) continue;

    for (const player of players) {
      const pred = predsByPlayerMatch.get(`${player.id}:${match.id}`);
      if (!pred) continue;

      const scored = scoreMatchPrediction(match, pred, scoringConfig);
      scoredPicks.push({
        playerName: player.display_name,
        match,
        predHome: pred.pred_home_score,
        predAway: pred.pred_away_score,
        points: scored.points,
      });
    }
  }

  const bestPoints = Math.max(...scoredPicks.map((p) => p.points), -1);
  const bestPicks = scoredPicks.filter((p) => p.points === bestPoints);
  const bestPick =
    bestPoints > 0
      ? {
          icon: "🔥",
          title: "Best Pick",
          headline: formatUniqueNames(bestPicks.map((p) => p.playerName)),
          detail: formatGroupedPickDetail(
            bestPicks,
            (points) => `${points} pts`
          ),
        }
      : null;

  const perfectDayPlayers = players
    .map((player) => ({
      name: player.display_name,
      count: countPerfectDays(matches, confirmed, player.id, scoringConfig),
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const perfectDayClub: HighlightCard =
    perfectDayPlayers.length > 0
      ? {
          icon: "⭐",
          title: "Perfect Day Club",
          headline: perfectDayPlayers.map((p) => p.name).join(", "),
          detail: perfectDayPlayers
            .map((p) => `${p.count} perfect day${p.count === 1 ? "" : "s"}`)
            .join(" · "),
        }
      : {
          icon: "⭐",
          title: "Perfect Day Club",
          headline: "No perfect days yet",
          detail: "Get every pick right on a 2+ match day",
        };

  type ChaosPickHighlight = PickHighlightRow;

  const chaosCandidates: ChaosPickHighlight[] = [];
  const upcomingMatches = matches.filter(canPickMatch);

  for (const match of upcomingMatches) {
    for (const player of players) {
      const pred = predsByPlayerMatch.get(`${player.id}:${match.id}`);
      if (!pred) continue;

      const preview = previewPickRewards(
        match,
        pred.pred_home_score,
        pred.pred_away_score,
        scoringConfig,
        pred.pred_winner_team_id
      );

      chaosCandidates.push({
        playerName: player.display_name,
        match,
        predHome: pred.pred_home_score,
        predAway: pred.pred_away_score,
        points: preview.maxPoints,
      });
    }
  }

  const chaosMax = Math.max(...chaosCandidates.map((p) => p.points), -1);
  const chaosPicks = chaosCandidates.filter((p) => p.points === chaosMax);
  const chaosPick =
    chaosMax > 0
      ? {
          icon: "🌪️",
          title: "Chaos Pick",
          headline: formatUniqueNames(chaosPicks.map((p) => p.playerName)),
          detail: formatGroupedPickDetail(
            chaosPicks,
            (points) => `up to ${points} pts`
          ),
        }
      : null;

  return {
    currentLeader,
    exactKing,
    miracleMaker,
    biggestClimber,
    bestPick,
    perfectDayClub,
    chaosPick,
  };
}
