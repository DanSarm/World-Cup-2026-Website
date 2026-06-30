import { cache } from "react";
import { getSupabase } from "./supabaseServer";
import { getSettings } from "./auth";
import { ensureMatchesSeeded } from "./matchesDb";
import { ensureTeamsSeeded } from "./teamsDb";
import { WORLD_CUP_TEAMS } from "./teamsData";
import {
  calculateLeaderboard,
  getFinalsChallengeLeaderboard,
  scoreMatchPrediction,
  countPerfectDays,
  scoringConfigFromSettings,
} from "./scoring";
import { buildProjectedPrizes } from "./payouts";
import { getEffectiveMatchPrediction, isConfirmedPick } from "./pickUtils";
import { resolvePlayerPodium } from "./podiumDisplay";
import { buildRecentFormByPlayer } from "./recentPickForm";
import { filterCommunityPicksByMatchForViewer } from "./pickVisibility";
import { findLiveMatch, hasAnyDisplayableLiveScore, shouldAutoFinalizeMatch, isMatchDecidedForScoring, isAnyMatchNeedingScoreSync } from "./matchLive";
import { shouldPromoteScheduledMatchWithScores } from "./matchFinalize";
import {
  findLatestDecidedMatch,
  rankMovementFromRanks,
  revertMatchForScoring,
} from "./rankMovement";
import { mergeLiveClocks } from "./liveClock";
import { matchDateKey } from "./utils";
import {
  applyKnownKnockoutTeams,
  resolveMatchesForPicks,
} from "./resolvedMatches";
import type {
  ActualTournamentResults,
  BigPrediction,
  CommunityMatchPick,
  FinalsChallengePrediction,
  LeaderboardEntry,
  ManualAdjustment,
  Match,
  MatchPrediction,
  Player,
  Team,
  TournamentPodiumPrediction,
} from "./types";

export type { CommunityMatchPick } from "./types";

async function loadTeams(): Promise<Team[]> {
  try {
    await ensureTeamsSeeded();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("group_letter")
      .order("name");
    if (!error && data && data.length > 0) return data as Team[];
  } catch {
    // fall through to static list
  }

  return WORLD_CUP_TEAMS.map((t, i) => ({
    ...t,
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  })) as Team[];
}

export const getTeams = cache(loadTeams);

async function loadPlayers(): Promise<Player[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from("players").select("*").order("display_name");
  return (data ?? []) as Player[];
}

export const getPlayers = cache(loadPlayers);

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeMatch(row: Match): Match {
  return {
    ...row,
    home_win_bonus: row.home_win_bonus ?? 0,
    draw_bonus: row.draw_bonus ?? 0,
    away_win_bonus: row.away_win_bonus ?? 0,
    home_advance_bonus: row.home_advance_bonus ?? 0,
    away_advance_bonus: row.away_advance_bonus ?? 0,
    odds_event_id: row.odds_event_id ?? null,
    odds_last_synced_at: row.odds_last_synced_at ?? row.odds_checked_at ?? null,
    odds_locked_at: row.odds_locked_at ?? null,
    odds_status: row.odds_status ?? "not_synced",
    home_implied_probability: toNullableNumber(row.home_implied_probability),
    draw_implied_probability: toNullableNumber(row.draw_implied_probability),
    away_implied_probability: toNullableNumber(row.away_implied_probability),
    home_advance_probability: toNullableNumber(row.home_advance_probability),
    away_advance_probability: toNullableNumber(row.away_advance_probability),
    live_updated_at: row.live_updated_at ?? null,
    odds_source_note: row.odds_source_note ?? row.odds_source ?? null,
  };
}

async function syncKnownKnockoutTeamAssignments(
  rawMatches: Match[],
  resolvedMatches: Match[]
): Promise<void> {
  const rawById = new Map(rawMatches.map((m) => [m.id, m]));
  const supabase = getSupabase();
  const updates: PromiseLike<unknown>[] = [];

  for (const resolved of resolvedMatches) {
    if (resolved.match_number < 73) continue;
    if (!resolved.home_team_id || !resolved.away_team_id) continue;

    const raw = rawById.get(resolved.id);
    if (!raw) continue;
    if (
      raw.home_team_id === resolved.home_team_id &&
      raw.away_team_id === resolved.away_team_id
    ) {
      continue;
    }

    updates.push(
      supabase
        .from("matches")
        .update({
          home_team_id: resolved.home_team_id,
          away_team_id: resolved.away_team_id,
          home_label: resolved.home_label ?? resolved.home_team?.name ?? null,
          away_label: resolved.away_label ?? resolved.away_team?.name ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", resolved.id)
    );
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

async function loadMatchesWithTeams(): Promise<Match[]> {
  await ensureMatchesSeeded();
  const supabase = getSupabase();
  const { data } = await supabase
    .from("matches")
    .select(
      "*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)"
    )
    .order("match_number");
  const rawMatches = ((data ?? []) as Match[]).map(normalizeMatch);
  const resolvedMatches = applyKnownKnockoutTeams(rawMatches);
  await syncKnownKnockoutTeamAssignments(rawMatches, resolvedMatches);
  return resolvedMatches;
}

const getMatchesWithTeamsMemo = cache(loadMatchesWithTeams);

/** Memoized per request — use getMatchesWithTeamsFresh after odds/knockout DB writes. */
export async function getMatchesWithTeams(): Promise<Match[]> {
  return getMatchesWithTeamsMemo();
}

export async function getMatchesWithTeamsFresh(): Promise<Match[]> {
  return loadMatchesWithTeams();
}

/** Supabase caps unbounded selects at 1000 rows — paginate so leaderboard sees every pick. */
const PREDICTIONS_PAGE_SIZE = 1000;

async function fetchAllPredictionsFromDb(): Promise<MatchPrediction[]> {
  const supabase = getSupabase();
  const rows: MatchPrediction[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("match_predictions")
      .select("*")
      .order("id")
      .range(offset, offset + PREDICTIONS_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as MatchPrediction[];
    rows.push(...page);
    if (page.length < PREDICTIONS_PAGE_SIZE) break;
    offset += PREDICTIONS_PAGE_SIZE;
  }

  return rows;
}

const getAllPredictionsCached = cache(fetchAllPredictionsFromDb);

/** All pool predictions (paginated). Pass playerId to filter after load — same source as leaderboard. */
export async function getPredictions(
  playerId?: string
): Promise<MatchPrediction[]> {
  const all = await getAllPredictionsCached();
  if (!playerId) return all;
  return all.filter((p) => p.player_id === playerId);
}

export async function getConfirmedMatchPicks(
  matchId: string
): Promise<CommunityMatchPick[]> {
  const byMatch = await getConfirmedMatchPicksByMatchIds([matchId]);
  return byMatch.get(matchId) ?? [];
}

type CommunityPickRow = {
  match_id: string;
  player_id: string;
  pred_home_score: number;
  pred_away_score: number;
  pred_winner_team_id: string | null;
  pick_confirmed?: boolean;
  players:
    | { display_name: string; avatar_emoji: string | null }
    | { display_name: string; avatar_emoji: string | null }[]
    | null;
};

async function fetchConfirmedPickRows(
  matchIds: string[]
): Promise<CommunityPickRow[]> {
  if (matchIds.length === 0) return [];

  const supabase = getSupabase();
  const primary = await supabase
    .from("match_predictions")
    .select(
      "match_id, player_id, pred_home_score, pred_away_score, pred_winner_team_id, pick_confirmed, players(display_name, avatar_emoji)"
    )
    .in("match_id", matchIds)
    .eq("pick_confirmed", true);

  let rows: unknown[] | null = primary.data;
  let error = primary.error;

  if (error?.message.includes("pick_confirmed")) {
    const fallback = await supabase
      .from("match_predictions")
      .select(
        "match_id, player_id, pred_home_score, pred_away_score, pred_winner_team_id, players(display_name, avatar_emoji)"
      )
      .in("match_id", matchIds);
    rows = fallback.data;
    error = fallback.error;
  }

  if (error || !rows) return [];
  return rows as CommunityPickRow[];
}

export async function getConfirmedMatchPicksByMatchIds(
  matchIds: string[]
): Promise<Map<string, CommunityMatchPick[]>> {
  const uniqueMatchIds = [...new Set(matchIds)];
  const byMatch = new Map<string, CommunityMatchPick[]>(
    uniqueMatchIds.map((id) => [id, []])
  );
  if (uniqueMatchIds.length === 0) return byMatch;

  const rows = await fetchConfirmedPickRows(uniqueMatchIds);
  const confirmedRows = rows.filter((row) => row.pick_confirmed !== false);
  const playerIds = [...new Set(confirmedRows.map((row) => row.player_id))];

  const [teams, podiumPredictions, matches, allPredictions, settings] =
    await Promise.all([
      getTeams(),
      getTournamentPodiumPredictions(),
      getMatchesWithTeams(),
      getPredictions(),
      getSettings(),
    ]);
  const podiumByPlayer = new Map(
    podiumPredictions.map((p) => [p.player_id, p])
  );
  const scoringConfig = scoringConfigFromSettings(settings);
  const recentFormByPlayer = buildRecentFormByPlayer(
    playerIds,
    matches,
    allPredictions,
    scoringConfig
  );

  for (const row of confirmedRows) {
    const player = Array.isArray(row.players) ? row.players[0] : row.players;
    if (!player) continue;
    const pick: CommunityMatchPick = {
      playerId: row.player_id,
      displayName: player.display_name,
      avatarEmoji: player.avatar_emoji ?? "⚽",
      predHomeScore: row.pred_home_score,
      predAwayScore: row.pred_away_score,
      predWinnerTeamId: row.pred_winner_team_id,
      podiumPicks: resolvePlayerPodium(
        podiumByPlayer.get(row.player_id),
        teams
      ),
      recentForm: recentFormByPlayer.get(row.player_id),
    };
    const list = byMatch.get(row.match_id) ?? [];
    list.push(pick);
    byMatch.set(row.match_id, list);
  }

  for (const picks of byMatch.values()) {
    picks.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return byMatch;
}

async function loadTournamentPodiumPredictions(): Promise<
  TournamentPodiumPrediction[]
> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("tournament_podium_predictions")
    .select("*");
  return (data ?? []) as TournamentPodiumPrediction[];
}

export const getTournamentPodiumPredictions = cache(
  loadTournamentPodiumPredictions
);

async function loadMyTournamentPodium(
  playerId: string
): Promise<TournamentPodiumPrediction | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("tournament_podium_predictions")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();
  return (data as TournamentPodiumPrediction | null) ?? null;
}

export const getMyTournamentPodium = cache(loadMyTournamentPodium);

export async function getBigPredictions(): Promise<BigPrediction[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from("big_predictions").select("*");
  return (data ?? []) as BigPrediction[];
}

async function loadFinalsPredictions(): Promise<FinalsChallengePrediction[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from("finals_challenge_predictions").select("*");
  return (data ?? []) as FinalsChallengePrediction[];
}

export const getFinalsPredictions = cache(loadFinalsPredictions);

async function loadAdjustments(): Promise<ManualAdjustment[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from("manual_adjustments").select("*");
  return (data ?? []) as ManualAdjustment[];
}

export const getAdjustments = cache(loadAdjustments);

async function loadActualResults(): Promise<ActualTournamentResults> {
  const supabase = getSupabase();
  const { data } = await supabase.from("actual_tournament_results").select("*");
  const results: ActualTournamentResults = {};
  for (const row of data ?? []) {
    const key = row.key as string;
    switch (key) {
      case "group_winners":
        results.group_winners = row.value as Record<string, string>;
        break;
      case "group_runners_up":
        results.group_runners_up = row.value as Record<string, string>;
        break;
      case "team_rounds_reached":
        results.team_rounds_reached = row.value as Record<string, string>;
        break;
      case "semifinalists":
        results.semifinalists = row.value as string[];
        break;
      case "finalists":
        results.finalists = row.value as string[];
        break;
      case "quarterfinalists":
        results.quarterfinalists = row.value as string[];
        break;
      case "champion":
        results.champion = row.value as string;
        break;
      case "runner_up":
        results.runner_up = row.value as string;
        break;
      case "third_place":
        results.third_place = row.value as string;
        break;
      case "top_scorer":
        results.top_scorer = row.value as string;
        break;
    }
  }
  return results;
}

export const getActualResults = cache(loadActualResults);

/**
 * Rank movement = current rank vs the board immediately before the most
 * recently played match had its result applied.
 */
function attachRankMovement(
  current: LeaderboardEntry[],
  players: Player[],
  matches: Match[],
  predictions: MatchPrediction[],
  podiumPredictions: TournamentPodiumPrediction[],
  finalsPredictions: FinalsChallengePrediction[],
  adjustments: ManualAdjustment[],
  settings: Awaited<ReturnType<typeof getSettings>>,
  actualResults: ActualTournamentResults,
  teams: Team[]
): LeaderboardEntry[] {
  const latestMatch = findLatestDecidedMatch(matches);
  if (!latestMatch) {
    return current.map((e) => ({ ...e, rankMovement: "same" as const }));
  }

  const priorMatches = matches.map((m) =>
    m.id === latestMatch.id ? revertMatchForScoring(m) : m
  );

  const scoringOpts = { includeLiveScores: false };
  const projectedPrizes = new Map<string, number>();

  const afterBoard = calculateLeaderboard(
    players,
    matches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    projectedPrizes,
    teams,
    scoringOpts
  );
  const beforeBoard = calculateLeaderboard(
    players,
    priorMatches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    projectedPrizes,
    teams,
    scoringOpts
  );

  const afterRankByPlayer = new Map(afterBoard.map((e) => [e.playerId, e.rank]));
  const beforeRankByPlayer = new Map(
    beforeBoard.map((e) => [e.playerId, e.rank])
  );

  return current.map((entry) => {
    const rankMovement = rankMovementFromRanks(
      beforeRankByPlayer.get(entry.playerId),
      afterRankByPlayer.get(entry.playerId)
    );
    return { ...entry, rankMovement };
  });
}

async function finalizeScheduledMatchesWithScores(
  matches: Match[]
): Promise<number> {
  const supabase = getSupabase();
  let count = 0;
  const now = Date.now();

  for (const match of matches) {
    if (!shouldPromoteScheduledMatchWithScores(match, now)) continue;

    const { error } = await supabase
      .from("matches")
      .update({ status: "final", updated_at: new Date().toISOString() })
      .eq("id", match.id);
    if (!error) count++;
  }
  return count;
}

export async function getLeaderboardData(options?: {
  includeLiveScores?: boolean;
  /** Skip ESPN/API score sync during SSR — client polls instead (fixes slow iOS loads). */
  skipScoreSync?: boolean;
}): Promise<{
  leaderboard: LeaderboardEntry[];
  finalsLeaderboard: ReturnType<typeof getFinalsChallengeLeaderboard>;
  settings: Awaited<ReturnType<typeof getSettings>>;
  players: Player[];
  matches: Match[];
  liveMatch: Match | null;
  hasLiveScoring: boolean;
}> {
  const includeLiveScores = options?.includeLiveScores ?? false;
  const skipScoreSync = options?.skipScoreSync ?? false;
  let matches = await getMatchesWithTeams();

  if (
    !skipScoreSync &&
    (isAnyMatchNeedingScoreSync(matches) || matches.some(shouldAutoFinalizeMatch))
  ) {
    const { syncLiveScores } = await import("./scores/sync");
    await syncLiveScores(true);
    matches = await getMatchesWithTeams();
  }
  if (await finalizeScheduledMatchesWithScores(matches)) {
    matches = await getMatchesWithTeams();
  }
  const [players, scoredPredictions, podiumPredictions, finalsPredictions, adjustments, actualResults, settings, teams] =
    await Promise.all([
      getPlayers(),
      getPredictions(),
      getTournamentPodiumPredictions(),
      getFinalsPredictions(),
      getAdjustments(),
      getActualResults(),
      getSettings(),
      getTeams(),
    ]);

  const podiumByPlayer = new Map(
    podiumPredictions.map((p) => [p.player_id, p])
  );
  const scoringConfig = scoringConfigFromSettings(settings);
  const recentFormByPlayer = buildRecentFormByPlayer(
    players.map((p) => p.id),
    matches,
    scoredPredictions,
    scoringConfig
  );
  const attachPlayerExtras = (entries: LeaderboardEntry[]) =>
    entries.map((entry) => ({
      ...entry,
      podiumPicks: resolvePlayerPodium(
        podiumByPlayer.get(entry.playerId),
        teams
      ),
      recentForm: recentFormByPlayer.get(entry.playerId),
    }));

  const tempLb = calculateLeaderboard(
    players,
    matches,
    scoredPredictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    new Map(),
    teams
  );

  const projectedPrizes = buildProjectedPrizes(
    players,
    tempLb,
    finalsPredictions,
    actualResults,
    settings
  );

  const leaderboard = attachPlayerExtras(
    attachRankMovement(
      calculateLeaderboard(
        players,
        matches,
        scoredPredictions,
        podiumPredictions,
        finalsPredictions,
        adjustments,
        settings,
        actualResults,
        projectedPrizes,
        teams,
        { includeLiveScores }
      ),
      players,
      matches,
      scoredPredictions,
      podiumPredictions,
      finalsPredictions,
      adjustments,
      settings,
      actualResults,
      teams
    )
  );

  const finalsLeaderboard = getFinalsChallengeLeaderboard(
    players,
    finalsPredictions,
    actualResults
  );

  const liveMatch = findLiveMatch(matches);

  return {
    leaderboard,
    finalsLeaderboard,
    settings,
    players,
    matches,
    liveMatch,
    hasLiveScoring: hasAnyDisplayableLiveScore(matches),
  };
}

export async function getLiveSnapshot() {
  const { syncLiveScores } = await import("./scores/sync");
  const sync = await syncLiveScores(false);
  const snapshot = await getLeaderboardData({ includeLiveScores: true });
  const matches = mergeLiveClocks(snapshot.matches, sync.liveClockByMatchId);
  const liveMatch = findLiveMatch(matches);
  return { sync, ...snapshot, matches, liveMatch };
}

export async function getPicksSnapshot(playerId: string) {
  let matches = mergeLiveClocks(await getMatchesWithTeams(), undefined);
  let pickMatches = resolveMatchesForPicks(matches);

  const { maybeSyncUpcomingOdds } = await import("./odds/sync");
  const oddsResult = await maybeSyncUpcomingOdds(pickMatches);
  if (oddsResult.synced) {
    matches = mergeLiveClocks(await getMatchesWithTeamsFresh(), undefined);
    pickMatches = resolveMatchesForPicks(matches);
  }

  const matchIds = pickMatches.map((m) => m.id);

  const [predictions, players, communityPicksByMatchId] = await Promise.all([
    getPredictions(playerId),
    getPlayers(),
    getConfirmedMatchPicksByMatchIds(matchIds),
  ]);

  const communityPickCountsByMatchId = Object.fromEntries(
    [...communityPicksByMatchId.entries()].map(([id, picks]) => [id, picks.length])
  );

  return {
    syncedAt: new Date().toISOString(),
    matches: pickMatches,
    predictions,
    communityPicksByMatchId: filterCommunityPicksByMatchForViewer(
      communityPicksByMatchId,
      pickMatches,
      playerId
    ),
    communityPickCountsByMatchId,
    totalPlayers: players.length,
    hasLiveScoring: hasAnyDisplayableLiveScore(matches),
  };
}

export async function recalculateAllScores(options?: {
  notifyFinalizedMatchIds?: string[];
  notifyUpdatedMatchIds?: string[];
}): Promise<void> {
  const supabase = getSupabase();
  const [matches, , podiumPredictions, finalsPredictions, actualResults, settings, players, teams] =
    await Promise.all([
      getMatchesWithTeams(),
      getPredictions(),
      getTournamentPodiumPredictions(),
      getFinalsPredictions(),
      getActualResults(),
      getSettings(),
      getPlayers(),
      getTeams(),
    ]);

  const refreshedPredictions = await getPredictions();

  const { scoringConfigFromSettings } = await import("./scoring");
  const scoringConfig = scoringConfigFromSettings(settings);

  for (const pred of refreshedPredictions) {
    const match = matches.find((m) => m.id === pred.match_id);
    if (!match || !isMatchDecidedForScoring(match)) continue;
    const effective = getEffectiveMatchPrediction(match, pred);
    if (!effective) continue;
    const result = scoreMatchPrediction(match, effective, scoringConfig);
    await supabase
      .from("match_predictions")
      .update({
        points: result.points,
        exact_score: result.exactScore,
        correct_result: result.correctResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pred.id);
  }

  const { calculatePodiumPoints, calculateFinalsChallengePoints } =
    await import("./scoring");

  const teamsById = new Map(teams.map((t) => [t.id, t]));
  for (const pp of podiumPredictions) {
    const breakdown = calculatePodiumPoints(pp, actualResults, teamsById);
    const { error } = await supabase
      .from("tournament_podium_predictions")
      .update({
        points: breakdown.total,
        champion_points: breakdown.champion,
        runner_up_points: breakdown.runnerUp,
        third_place_points: breakdown.thirdPlace,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pp.id);
    if (error) {
      // Older DBs without the breakdown columns: persist the total only
      await supabase
        .from("tournament_podium_predictions")
        .update({ points: breakdown.total, updated_at: new Date().toISOString() })
        .eq("id", pp.id);
    }
  }

  for (const fp of finalsPredictions) {
    const points = calculateFinalsChallengePoints(fp, actualResults);
    await supabase
      .from("finals_challenge_predictions")
      .update({ points, updated_at: new Date().toISOString() })
      .eq("id", fp.id);
  }

  if (
    options?.notifyFinalizedMatchIds?.length ||
    options?.notifyUpdatedMatchIds?.length
  ) {
    const { fireScoreNotifications } = await import("./notifications/scoreEvents");
    fireScoreNotifications({
      finalizedMatchIds: options.notifyFinalizedMatchIds ?? [],
      updatedMatchIds: options.notifyUpdatedMatchIds ?? [],
    });
  }
}

export function computeFunStats(
  leaderboard: LeaderboardEntry[],
  matches: Match[],
  predictions: MatchPrediction[],
  settings?: import("./types").Settings
): {
  mostPoints: { name: string; points: number } | null;
  mostExactScores: { name: string; count: number } | null;
  mostMiraclePoints: { name: string; points: number } | null;
  bestPerfectDay: { name: string; count: number } | null;
} {
  const leader = [...leaderboard].sort(
    (a, b) => b.totalPoints - a.totalPoints
  )[0];
  const mostExact = [...leaderboard].sort(
    (a, b) => b.exactScores - a.exactScores
  )[0];
  const mostMiracle = [...leaderboard].sort(
    (a, b) => b.miraclePoints - a.miraclePoints
  )[0];

  const scoringConfig = settings
    ? scoringConfigFromSettings(settings)
    : undefined;

  let bestPerfectDay: { name: string; count: number } | null = null;
  for (const entry of leaderboard) {
    const count = countPerfectDays(
      matches,
      predictions,
      entry.playerId,
      scoringConfig
    );
    if (count > 0 && (!bestPerfectDay || count > bestPerfectDay.count)) {
      bestPerfectDay = { name: entry.displayName, count };
    }
  }

  return {
    mostPoints: leader
      ? { name: leader.displayName, points: leader.totalPoints }
      : null,
    mostExactScores: mostExact
      ? { name: mostExact.displayName, count: mostExact.exactScores }
      : null,
    mostMiraclePoints: mostMiracle && mostMiracle.miraclePoints > 0
      ? { name: mostMiracle.displayName, points: mostMiracle.miraclePoints }
      : null,
    bestPerfectDay,
  };
}
