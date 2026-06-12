import {
  getAdjustments,
  getActualResults,
  getFinalsPredictions,
  getLeaderboardData,
  getMatchesWithTeams,
  getPlayers,
  getPredictions,
  getTeams,
  getTournamentPodiumPredictions,
} from "./data";
import { getSettings } from "./auth";
import { computePoolHighlights, type HighlightCard, type PoolHighlights } from "./poolHighlights";
import { resolvePlayerPodium } from "./podiumDisplay";
import { isConfirmedPick, getEffectiveMatchPrediction } from "./pickUtils";
import {
  countPerfectDays,
  scoreMatchPrediction,
} from "./scoring";
import { scoringConfigFromSettings, type ScoringConfig } from "./scoringConfig";
import { formatMatchScoreBreakdownLines } from "./scoreBreakdownDisplay";
import {
  hasDisplayableLiveScore,
  isMatchDecidedForScoring,
  isMatchInPlayWindow,
  isAnyMatchInPlayWindow,
} from "./matchLive";
import type {
  LeaderboardEntry,
  Match,
  MatchPrediction,
  PlayerPodiumDisplay,
  TournamentPodiumPrediction,
} from "./types";
import { getStageLabel } from "./types";
import { syncLiveScores } from "./scores/sync";

export interface PlayerAchievement {
  icon: string;
  title: string;
  detail: string;
}

export type PlayerPickStatus = "upcoming" | "live" | "scored" | "missed";

export interface PlayerPickSummary {
  matchId: string;
  matchNumber: number;
  stageLabel: string;
  groupLetter: string | null;
  kickoffAt: string | null;
  homeLabel: string;
  awayLabel: string;
  homeCode: string | null;
  awayCode: string | null;
  predHome: number;
  predAway: number;
  predWinnerCode: string | null;
  actualHome: number | null;
  actualAway: number | null;
  status: PlayerPickStatus;
  points: number;
  livePoints: number | null;
  breakdownLines: string[];
  exactScore: boolean;
  correctResult: boolean;
}

export interface PlayerPointsBreakdown {
  matchPoints: number;
  groupStagePoints: number;
  knockoutPoints: number;
  hardPickBonusPoints: number;
  fireBonusPoints: number;
  miraclePoints: number;
  tournamentPickPoints: number;
  championPickPoints: number;
  runnerUpPickPoints: number;
  thirdPlacePickPoints: number;
  finalsChallengePoints: number;
  manualAdjustments: number;
  totalPoints: number;
  provisionalTotalPoints: number | null;
  livePoints: number | null;
}

export interface PlayerProfileData {
  playerId: string;
  displayName: string;
  avatarEmoji: string;
  paid: boolean;
  rank: number;
  entry: LeaderboardEntry;
  pointsBreakdown: PlayerPointsBreakdown;
  podiumPicks: PlayerPodiumDisplay | null;
  podiumPrediction: TournamentPodiumPrediction | null;
  picks: PlayerPickSummary[];
  achievements: PlayerAchievement[];
  recentForm: LeaderboardEntry["recentForm"];
  perfectDays: number;
  picksMade: number;
  exactScores: number;
  correctResults: number;
  hasLiveScoring: boolean;
}

function highlightDetail(detail: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(detail)) return detail[0] ?? fallback;
  return detail ?? fallback;
}

function highlightIncludesPlayer(
  highlight: HighlightCard | null,
  name: string
): boolean {
  if (!highlight) return false;
  return highlight.headline.split(", ").includes(name);
}

export function computePlayerAchievements(
  entry: LeaderboardEntry,
  poolHighlights: PoolHighlights,
  perfectDays: number
): PlayerAchievement[] {
  const achievements: PlayerAchievement[] = [];
  const name = entry.displayName;

  if (entry.rank === 1) {
    achievements.push({
      icon: "👑",
      title: "Current Leader",
      detail: `${entry.provisionalTotalPoints ?? entry.totalPoints} pts`,
    });
  } else if (entry.rank <= 3) {
    achievements.push({
      icon: "🏆",
      title: `Rank #${entry.rank}`,
      detail: "On the leaderboard podium",
    });
  }

  if (entry.paid) {
    achievements.push({
      icon: "💵",
      title: "Prize Pool",
      detail: "Competing for cash prizes",
    });
  }

  if (
    entry.exactScores > 0 &&
    highlightIncludesPlayer(poolHighlights.exactKing, name)
  ) {
    achievements.push({
      icon: "🎯",
      title: "Exact King",
      detail: `${entry.exactScores} exact score${entry.exactScores === 1 ? "" : "s"}`,
    });
  }

  if (
    entry.miraclePoints > 0 &&
    highlightIncludesPlayer(poolHighlights.miracleMaker, name)
  ) {
    achievements.push({
      icon: "🚀",
      title: "Miracle Maker",
      detail: `${entry.miraclePoints} miracle pts`,
    });
  }

  if (highlightIncludesPlayer(poolHighlights.biggestClimber, name)) {
    achievements.push({
      icon: "📈",
      title: "Biggest Climber",
      detail: highlightDetail(
        poolHighlights.biggestClimber?.detail,
        "Moved up the board"
      ),
    });
  }

  if (highlightIncludesPlayer(poolHighlights.bestPick, name)) {
    achievements.push({
      icon: "🔥",
      title: "Best Pick",
      detail: highlightDetail(
        poolHighlights.bestPick?.detail,
        "Top single-match haul"
      ),
    });
  }

  if (highlightIncludesPlayer(poolHighlights.chaosPick, name)) {
    achievements.push({
      icon: "🎲",
      title: "Chaos Pick",
      detail: highlightDetail(
        poolHighlights.chaosPick?.detail,
        "Bold underdog call"
      ),
    });
  }

  if (highlightIncludesPlayer(poolHighlights.perfectDayClub, name)) {
    achievements.push({
      icon: "⭐",
      title: "Perfect Day Club",
      detail: highlightDetail(poolHighlights.perfectDayClub.detail, "Perfect day"),
    });
  } else if (perfectDays > 0) {
    achievements.push({
      icon: "⭐",
      title: "Perfect Day",
      detail: `${perfectDays} day${perfectDays === 1 ? "" : "s"} with every pick correct`,
    });
  }

  if (entry.exactScores >= 3 && !highlightIncludesPlayer(poolHighlights.exactKing, name)) {
    achievements.push({
      icon: "🎯",
      title: "Sharpshooter",
      detail: `${entry.exactScores} exact scores`,
    });
  }

  if (entry.projectedPrize > 0 && entry.paid) {
    achievements.push({
      icon: "💰",
      title: "In the Money",
      detail: `Projected ${entry.prizeLabel.toLowerCase()} payout`,
    });
  }

  return achievements;
}

function pickStatus(match: Match): PlayerPickStatus {
  if (isMatchDecidedForScoring(match)) return "scored";
  if (hasDisplayableLiveScore(match) || isMatchInPlayWindow(match)) {
    return "live";
  }
  return "upcoming";
}

export function buildPlayerPickSummariesWithConfig(
  playerId: string,
  matches: Match[],
  predictions: MatchPrediction[],
  scoringConfig: ScoringConfig,
  allowLive: boolean
): PlayerPickSummary[] {
  const predByMatch = new Map(
    predictions
      .filter((p) => p.player_id === playerId && isConfirmedPick(p))
      .map((p) => [p.match_id, p])
  );

  const summaries: PlayerPickSummary[] = [];

  for (const match of matches) {
    const prediction = predByMatch.get(match.id);
    const effective = getEffectiveMatchPrediction(match, prediction);
    if (!effective) continue;

    const status = pickStatus(match);
    const decided = isMatchDecidedForScoring(match);
    const liveScorable = allowLive && hasDisplayableLiveScore(match);

    let points = 0;
    let livePoints: number | null = null;
    let breakdownLines: string[] = [];
    let exactScore = false;
    let correctResult = false;

    if (decided && prediction) {
      const result = scoreMatchPrediction(match, prediction, scoringConfig);
      points = result.points;
      exactScore = result.exactScore;
      correctResult = result.correctResult;
      if (match.home_score != null && match.away_score != null) {
        breakdownLines = formatMatchScoreBreakdownLines(match, result);
      }
    } else if (liveScorable && prediction) {
      const result = scoreMatchPrediction(match, prediction, scoringConfig, {
        allowLive: true,
      });
      livePoints = result.points;
      exactScore = result.exactScore;
      correctResult = result.correctResult;
      if (match.home_score != null && match.away_score != null) {
        breakdownLines = formatMatchScoreBreakdownLines(match, result);
      }
    }

    let predWinnerCode: string | null = null;
    if (effective.pred_winner_team_id) {
      predWinnerCode =
        effective.pred_winner_team_id === match.home_team_id
          ? (match.home_team?.fifa_code ?? null)
          : effective.pred_winner_team_id === match.away_team_id
            ? (match.away_team?.fifa_code ?? null)
            : null;
    }

    summaries.push({
      matchId: match.id,
      matchNumber: match.match_number,
      stageLabel: getStageLabel(match.stage),
      groupLetter: match.group_letter,
      kickoffAt: match.kickoff_at,
      homeLabel: match.home_team?.short_name ?? match.home_label,
      awayLabel: match.away_team?.short_name ?? match.away_label,
      homeCode: match.home_team?.fifa_code ?? null,
      awayCode: match.away_team?.fifa_code ?? null,
      predHome: effective.pred_home_score,
      predAway: effective.pred_away_score,
      predWinnerCode,
      actualHome: match.home_score,
      actualAway: match.away_score,
      status,
      points,
      livePoints,
      breakdownLines,
      exactScore,
      correctResult,
    });
  }

  return summaries.sort((a, b) => {
    const aTime = a.kickoffAt ?? "";
    const bTime = b.kickoffAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

export async function getPlayerProfileData(
  playerId: string
): Promise<PlayerProfileData | null> {
  const players = await getPlayers();
  const player = players.find((p) => p.id === playerId);
  if (!player) return null;

  let matches = await getMatchesWithTeams();
  if (isAnyMatchInPlayWindow(matches)) {
    await syncLiveScores();
  }

  const [
    leaderboardBundle,
    playerPredictions,
    allPredictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    actualResults,
    settings,
    teams,
  ] = await Promise.all([
    getLeaderboardData({ includeLiveScores: isAnyMatchInPlayWindow(matches) }),
    getPredictions(playerId),
    getPredictions(),
    getTournamentPodiumPredictions(),
    getFinalsPredictions(),
    getAdjustments(),
    getActualResults(),
    getSettings(),
    getTeams(),
  ]);

  matches = leaderboardBundle.matches;

  const entry = leaderboardBundle.leaderboard.find(
    (e: LeaderboardEntry) => e.playerId === playerId
  );
  if (!entry) return null;

  const scoringConfig = scoringConfigFromSettings(settings);
  const perfectDays = countPerfectDays(
    matches,
    allPredictions,
    playerId,
    scoringConfig
  );

  const poolHighlights = computePoolHighlights({
    players,
    matches,
    predictions: allPredictions,
    settings,
    leaderboard: leaderboardBundle.leaderboard,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    actualResults,
    teams,
  });

  const podiumPrediction =
    podiumPredictions.find((p: TournamentPodiumPrediction) => p.player_id === playerId) ??
    null;
  const podiumPicks = resolvePlayerPodium(podiumPrediction, teams);

  const picks = buildPlayerPickSummariesWithConfig(
    playerId,
    matches,
    playerPredictions,
    scoringConfig,
    leaderboardBundle.hasLiveScoring
  );

  const pointsBreakdown: PlayerPointsBreakdown = {
    matchPoints: entry.matchPoints,
    groupStagePoints: entry.groupStagePoints,
    knockoutPoints: entry.knockoutPoints,
    hardPickBonusPoints: entry.hardPickBonusPoints,
    fireBonusPoints: entry.fireBonusPoints,
    miraclePoints: entry.miraclePoints,
    tournamentPickPoints: entry.tournamentPickPoints,
    championPickPoints: entry.championPickPoints,
    runnerUpPickPoints: entry.runnerUpPickPoints,
    thirdPlacePickPoints: entry.thirdPlacePickPoints,
    finalsChallengePoints: entry.finalsChallengePoints,
    manualAdjustments: entry.manualAdjustments,
    totalPoints: entry.totalPoints,
    provisionalTotalPoints: entry.provisionalTotalPoints ?? null,
    livePoints: entry.livePoints ?? null,
  };

  return {
    playerId: player.id,
    displayName: player.display_name,
    avatarEmoji: player.avatar_emoji,
    paid: player.paid,
    rank: entry.rank,
    entry,
    pointsBreakdown,
    podiumPicks,
    podiumPrediction,
    picks,
    achievements: computePlayerAchievements(entry, poolHighlights, perfectDays),
    recentForm: entry.recentForm,
    perfectDays,
    picksMade: entry.picksMade,
    exactScores: entry.exactScores,
    correctResults: entry.correctResults,
    hasLiveScoring: leaderboardBundle.hasLiveScoring,
  };
}
