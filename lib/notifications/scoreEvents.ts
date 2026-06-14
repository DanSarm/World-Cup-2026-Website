import {
  getAdjustments,
  getActualResults,
  getFinalsPredictions,
  getMatchesWithTeams,
  getPlayers,
  getPredictions,
  getTeams,
  getTournamentPodiumPredictions,
} from "@/lib/data";
import { getSettings } from "@/lib/auth";
import { isMatchDecidedForScoring } from "@/lib/matchLive";
import { getEffectiveMatchPrediction, isConfirmedPick } from "@/lib/pickUtils";
import {
  findLatestDecidedMatch,
  revertMatchForScoring,
} from "@/lib/rankMovement";
import {
  calculateLeaderboard,
  scoreMatchPrediction,
  scoringConfigFromSettings,
} from "@/lib/scoring";
import type { Match, MatchPrediction } from "@/lib/types";
import {
  buildBigPointsNotification,
  buildCorrectResultNotification,
  buildExactScoreNotification,
  buildFireBonusNotification,
  buildLiveExactNotification,
  buildRankUpNotification,
  buildTopThreeNotification,
} from "./builders";
import { notifyPlayers } from "./dispatch";
import { BIG_POINTS_THRESHOLD } from "./types";

function isLiveMatch(match: Match): boolean {
  return match.status === "live" || match.status === "locked";
}

function predictionMatchesLiveScore(
  match: Match,
  prediction: MatchPrediction
): boolean {
  if (match.home_score == null || match.away_score == null) return false;
  return (
    prediction.pred_home_score === match.home_score &&
    prediction.pred_away_score === match.away_score
  );
}

async function buildFinalMatchNotifications(
  match: Match,
  predictions: MatchPrediction[],
  scoringConfig: ReturnType<typeof scoringConfigFromSettings>
) {
  const items: Array<{
    playerId: string;
    dedupeKey: string;
    payload: import("./types").AppNotificationPayload;
  }> = [];

  for (const prediction of predictions) {
    if (prediction.match_id !== match.id || !isConfirmedPick(prediction)) {
      continue;
    }

    const effective = getEffectiveMatchPrediction(match, prediction);
    if (!effective) continue;

    const scored = scoreMatchPrediction(match, effective, scoringConfig);
    const playerId = prediction.player_id;

    if (scored.exactScore) {
      const n = buildExactScoreNotification(match, scored.points);
      items.push({ playerId, ...n });
    } else if (scored.correctResult) {
      const n = buildCorrectResultNotification(match, scored.points);
      items.push({ playerId, ...n });
    }

    if (scored.fireBonus > 0) {
      const n = buildFireBonusNotification(match, scored.fireBonus);
      items.push({ playerId, ...n });
    }

    if (scored.points >= BIG_POINTS_THRESHOLD) {
      const n = buildBigPointsNotification(match, scored.points);
      items.push({ playerId, ...n });
    }
  }

  return items;
}

async function buildLiveMatchNotifications(
  match: Match,
  predictions: MatchPrediction[]
) {
  const items: Array<{
    playerId: string;
    dedupeKey: string;
    payload: import("./types").AppNotificationPayload;
  }> = [];

  for (const prediction of predictions) {
    if (prediction.match_id !== match.id || !isConfirmedPick(prediction)) {
      continue;
    }
    if (!predictionMatchesLiveScore(match, prediction)) continue;
    const n = buildLiveExactNotification(match);
    items.push({ playerId: prediction.player_id, ...n });
  }

  return items;
}

async function buildRankNotifications(finalizedMatchIds: string[]) {
  const [
    matches,
    players,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    actualResults,
    settings,
    teams,
  ] = await Promise.all([
    getMatchesWithTeams(),
    getPlayers(),
    getPredictions(),
    getTournamentPodiumPredictions(),
    getFinalsPredictions(),
    getAdjustments(),
    getActualResults(),
    getSettings(),
    getTeams(),
  ]);

  const latest = findLatestDecidedMatch(matches);
  if (!latest || !finalizedMatchIds.includes(latest.id)) {
    return [];
  }

  const priorMatches = matches.map((m) =>
    m.id === latest.id ? revertMatchForScoring(m) : m
  );

  const scoringOpts = { includeLiveScores: false };
  const beforeLb = calculateLeaderboard(
    players,
    priorMatches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    new Map(),
    teams,
    scoringOpts
  );
  const afterLb = calculateLeaderboard(
    players,
    matches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    new Map(),
    teams,
    scoringOpts
  );

  const beforeRank = new Map(beforeLb.map((e) => [e.playerId, e.rank]));
  const afterRank = new Map(afterLb.map((e) => [e.playerId, e.rank]));

  const items: Array<{
    playerId: string;
    dedupeKey: string;
    payload: import("./types").AppNotificationPayload;
  }> = [];

  for (const entry of afterLb) {
    const prev = beforeRank.get(entry.playerId);
    const next = afterRank.get(entry.playerId);
    if (prev == null || next == null || prev <= next) continue;

    const spots = prev - next;
    const rankN = buildRankUpNotification(latest, next, spots);
    items.push({ playerId: entry.playerId, ...rankN });

    if (next <= 3 && prev > 3) {
      const topN = buildTopThreeNotification(latest, next);
      items.push({ playerId: entry.playerId, ...topN });
    }
  }

  return items;
}

export interface TriggerScoreNotificationsResult {
  sent: number;
  skipped: number;
}

/** Event-driven notifications — no cron. Fires after scores update or a match finalizes. */
export async function triggerScoreNotifications(input: {
  finalizedMatchIds?: string[];
  updatedMatchIds?: string[];
}): Promise<TriggerScoreNotificationsResult> {
  const finalizedMatchIds = input.finalizedMatchIds ?? [];
  const updatedMatchIds = input.updatedMatchIds ?? [];
  if (!finalizedMatchIds.length && !updatedMatchIds.length) {
    return { sent: 0, skipped: 0 };
  }

  const { isPushConfigured } = await import("@/lib/push/vapid");
  if (!isPushConfigured()) {
    return { sent: 0, skipped: 0 };
  }

  const [matches, predictions, settings] = await Promise.all([
    getMatchesWithTeams(),
    getPredictions(),
    getSettings(),
  ]);
  const scoringConfig = scoringConfigFromSettings(settings);
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const queue: Array<{
    playerId: string;
    dedupeKey: string;
    payload: import("./types").AppNotificationPayload;
  }> = [];

  for (const matchId of finalizedMatchIds) {
    const match = matchById.get(matchId);
    if (!match || !isMatchDecidedForScoring(match)) continue;
    queue.push(...(await buildFinalMatchNotifications(match, predictions, scoringConfig)));
  }

  for (const matchId of updatedMatchIds) {
    if (finalizedMatchIds.includes(matchId)) continue;
    const match = matchById.get(matchId);
    if (!match || !isLiveMatch(match)) continue;
    queue.push(...(await buildLiveMatchNotifications(match, predictions)));
  }

  if (finalizedMatchIds.length) {
    queue.push(...(await buildRankNotifications(finalizedMatchIds)));
  }

  return notifyPlayers(queue);
}

export function fireScoreNotifications(input: {
  finalizedMatchIds?: string[];
  updatedMatchIds?: string[];
}): void {
  void triggerScoreNotifications(input).catch((error) => {
    console.error("triggerScoreNotifications:", error);
  });
}
