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
import { previewPickRewards, scoringConfigFromSettings, type ScoringConfig } from "./scoringConfig";
import { formatMatchScoreBreakdownLines } from "./scoreBreakdownDisplay";
import { canRevealOtherPlayersPicks } from "./pickVisibility";
import {
  hasDisplayableLiveScore,
  isMatchDecidedForScoring,
  isMatchInPlayWindow,
  isAnyMatchNeedingScoreSync,
} from "./matchLive";
import type {
  LeaderboardEntry,
  Match,
  MatchPrediction,
  PlayerPodiumDisplay,
  TournamentPodiumPrediction,
} from "./types";
import { canPickMatch } from "./utils";
import { getStageLabel } from "./types";
import { syncLiveScores } from "./scores/sync";

export type AchievementTier = "legendary" | "gold" | "silver" | "bronze";

export type AchievementIcon =
  | "trophy"
  | "medal-2"
  | "medal-3"
  | "target"
  | "flame"
  | "rocket"
  | "chart"
  | "dice"
  | "star"
  | "cash"
  | "shield";

export interface PlayerAchievement {
  id: string;
  tier: AchievementTier;
  icon: AchievementIcon;
  title: string;
  /** Short headline stat — e.g. "3 exact", "42 pts" */
  stat?: string;
  /** One-line context — match name, payout tier, etc. */
  subtitle?: string;
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

const TIER_RANK: Record<AchievementTier, number> = {
  legendary: 0,
  gold: 1,
  silver: 2,
  bronze: 3,
};

function matchTeamsLabel(match: Match): string {
  const home = match.home_team?.short_name ?? match.home_label;
  const away = match.away_team?.short_name ?? match.away_label;
  return `${home} vs ${away}`;
}

function climberSubtitle(detail: string | string[] | undefined): string {
  const line = Array.isArray(detail) ? detail[0] : detail;
  if (!line) return "Moved up the board";
  return line.replace(/^Up /, "↑ ").replace(" since tournament start", "");
}

function findPlayerBestScoredPick(
  playerId: string,
  matches: Match[],
  predictions: MatchPrediction[],
  scoringConfig: ScoringConfig
): { points: number; match: Match; predHome: number; predAway: number } | null {
  let best: { points: number; match: Match; predHome: number; predAway: number } | null =
    null;

  for (const match of matches.filter(isMatchDecidedForScoring)) {
    if (match.home_score === null || match.away_score === null) continue;
    const pred = predictions.find(
      (p) => p.player_id === playerId && p.match_id === match.id && isConfirmedPick(p)
    );
    if (!pred) continue;

    const { points } = scoreMatchPrediction(match, pred, scoringConfig);
    if (!best || points > best.points) {
      best = {
        points,
        match,
        predHome: pred.pred_home_score,
        predAway: pred.pred_away_score,
      };
    }
  }

  return best && best.points > 0 ? best : null;
}

function findPlayerChaosPick(
  playerId: string,
  matches: Match[],
  predictions: MatchPrediction[],
  scoringConfig: ScoringConfig
): { points: number; match: Match; predHome: number; predAway: number } | null {
  let best: { points: number; match: Match; predHome: number; predAway: number } | null =
    null;

  for (const match of matches.filter(canPickMatch)) {
    const pred = predictions.find(
      (p) => p.player_id === playerId && p.match_id === match.id && isConfirmedPick(p)
    );
    if (!pred) continue;

    const preview = previewPickRewards(
      match,
      pred.pred_home_score,
      pred.pred_away_score,
      scoringConfig,
      pred.pred_winner_team_id
    );

    if (!best || preview.maxPoints > best.points) {
      best = {
        points: preview.maxPoints,
        match,
        predHome: pred.pred_home_score,
        predAway: pred.pred_away_score,
      };
    }
  }

  return best && best.points > 0 ? best : null;
}

function sortAchievements(achievements: PlayerAchievement[]): PlayerAchievement[] {
  return [...achievements].sort(
    (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]
  );
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
  perfectDays: number,
  context?: {
    playerId: string;
    matches: Match[];
    predictions: MatchPrediction[];
    scoringConfig: ScoringConfig;
  }
): PlayerAchievement[] {
  const achievements: PlayerAchievement[] = [];
  const name = entry.displayName;
  const displayPoints = entry.provisionalTotalPoints ?? entry.totalPoints;

  if (entry.rank === 1) {
    achievements.push({
      id: "current-leader",
      tier: "legendary",
      icon: "trophy",
      title: "Current Leader",
      stat: `${displayPoints} pts`,
      subtitle: "Top of the board",
    });
  } else if (entry.rank === 2) {
    achievements.push({
      id: "rank-2",
      tier: "gold",
      icon: "medal-2",
      title: "2nd Place",
      stat: `${displayPoints} pts`,
      subtitle: "Leaderboard podium",
    });
  } else if (entry.rank === 3) {
    achievements.push({
      id: "rank-3",
      tier: "gold",
      icon: "medal-3",
      title: "3rd Place",
      stat: `${displayPoints} pts`,
      subtitle: "Leaderboard podium",
    });
  }

  if (entry.paid) {
    achievements.push({
      id: "prize-pool",
      tier: "bronze",
      icon: "shield",
      title: "Prize Pool",
      subtitle: "Playing for cash",
    });
  }

  if (
    entry.exactScores > 0 &&
    highlightIncludesPlayer(poolHighlights.exactKing, name)
  ) {
    achievements.push({
      id: "exact-king",
      tier: "gold",
      icon: "target",
      title: "Exact King",
      stat: `${entry.exactScores} exact`,
      subtitle: "Most bullseyes in the pool",
    });
  }

  if (
    entry.miraclePoints > 0 &&
    highlightIncludesPlayer(poolHighlights.miracleMaker, name)
  ) {
    achievements.push({
      id: "miracle-maker",
      tier: "gold",
      icon: "rocket",
      title: "Miracle Maker",
      stat: `${entry.miraclePoints} pts`,
      subtitle: "Underdog bonus king",
    });
  }

  if (highlightIncludesPlayer(poolHighlights.biggestClimber, name)) {
    achievements.push({
      id: "biggest-climber",
      tier: "silver",
      icon: "chart",
      title: "Biggest Climber",
      subtitle: climberSubtitle(poolHighlights.biggestClimber?.detail),
    });
  }

  if (highlightIncludesPlayer(poolHighlights.bestPick, name) && context) {
    const best = findPlayerBestScoredPick(
      context.playerId,
      context.matches,
      context.predictions,
      context.scoringConfig
    );
    achievements.push({
      id: "best-pick",
      tier: "gold",
      icon: "flame",
      title: "Best Pick",
      stat: best ? `${best.points} pts` : undefined,
      subtitle: best ? matchTeamsLabel(best.match) : "Top single-match haul",
    });
  }

  if (highlightIncludesPlayer(poolHighlights.chaosPick, name) && context) {
    const chaos = findPlayerChaosPick(
      context.playerId,
      context.matches,
      context.predictions,
      context.scoringConfig
    );
    achievements.push({
      id: "chaos-pick",
      tier: "gold",
      icon: "dice",
      title: "Chaos Pick",
      stat: chaos ? `Up to ${chaos.points}` : undefined,
      subtitle: chaos ? matchTeamsLabel(chaos.match) : "Bold underdog call",
    });
  }

  if (perfectDays > 0) {
    const inClub = highlightIncludesPlayer(poolHighlights.perfectDayClub, name);
    achievements.push({
      id: inClub ? "perfect-day-club" : "perfect-day",
      tier: inClub ? "gold" : "silver",
      icon: "star",
      title: inClub ? "Perfect Day Club" : "Perfect Day",
      stat:
        perfectDays === 1 ? "1× perfect" : `${perfectDays}× perfect`,
      subtitle: "Every pick correct on a busy day",
    });
  }

  if (
    entry.exactScores >= 3 &&
    !highlightIncludesPlayer(poolHighlights.exactKing, name)
  ) {
    achievements.push({
      id: "sharpshooter",
      tier: "silver",
      icon: "target",
      title: "Sharpshooter",
      stat: `${entry.exactScores} exact`,
      subtitle: "On the mark",
    });
  }

  if (entry.projectedPrize > 0 && entry.paid) {
    achievements.push({
      id: "in-the-money",
      tier: "gold",
      icon: "cash",
      title: "In the Money",
      subtitle: entry.prizeLabel,
    });
  }

  return sortAchievements(achievements);
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
  playerId: string,
  viewerPlayerId?: string
): Promise<PlayerProfileData | null> {
  const players = await getPlayers();
  const player = players.find((p) => p.id === playerId);
  if (!player) return null;

  let matches = await getMatchesWithTeams();
  if (isAnyMatchNeedingScoreSync(matches)) {
    await syncLiveScores(true);
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
    getLeaderboardData({ includeLiveScores: isAnyMatchNeedingScoreSync(matches) }),
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

  const isOwnProfile = !viewerPlayerId || viewerPlayerId === playerId;
  const matchesById = new Map(matches.map((m) => [m.id, m]));
  const visiblePicks = isOwnProfile
    ? picks
    : picks.filter((pick) => {
        const match = matchesById.get(pick.matchId);
        return match != null && canRevealOtherPlayersPicks(match);
      });

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
    picks: visiblePicks,
    achievements: computePlayerAchievements(entry, poolHighlights, perfectDays, {
      playerId,
      matches,
      predictions: allPredictions,
      scoringConfig,
    }),
    recentForm: entry.recentForm,
    perfectDays,
    picksMade: entry.picksMade,
    exactScores: entry.exactScores,
    correctResults: entry.correctResults,
    hasLiveScoring: leaderboardBundle.hasLiveScoring,
  };
}
