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
import { findLiveMatch, hasAnyDisplayableLiveScore, shouldAutoFinalizeMatch, isMatchDecidedForScoring, isAnyMatchInPlayWindow } from "./matchLive";
import { mergeLiveClocks } from "./liveClock";
import { matchDateKey } from "./utils";
import { resolveMatchesForPicks } from "./resolvedMatches";
import type {
  ActualTournamentResults,
  BigPrediction,
  FinalsChallengePrediction,
  LeaderboardEntry,
  ManualAdjustment,
  Match,
  MatchPrediction,
  PickFormSlot,
  Player,
  PlayerPodiumDisplay,
  Team,
  TournamentPodiumPrediction,
} from "./types";

export async function getTeams(): Promise<Team[]> {
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

export async function getPlayers(): Promise<Player[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from("players").select("*").order("display_name");
  return (data ?? []) as Player[];
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
    home_implied_probability: row.home_implied_probability ?? null,
    draw_implied_probability: row.draw_implied_probability ?? null,
    away_implied_probability: row.away_implied_probability ?? null,
    home_advance_probability: row.home_advance_probability ?? null,
    away_advance_probability: row.away_advance_probability ?? null,
    live_updated_at: row.live_updated_at ?? null,
    odds_source_note: row.odds_source_note ?? row.odds_source ?? null,
  };
}

export async function getMatchesWithTeams(): Promise<Match[]> {
  await ensureMatchesSeeded();
  const supabase = getSupabase();
  const { data } = await supabase
    .from("matches")
    .select(
      "*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)"
    )
    .order("match_number");
  return ((data ?? []) as Match[]).map(normalizeMatch);
}

export async function getPredictions(
  playerId?: string
): Promise<MatchPrediction[]> {
  const supabase = getSupabase();
  let query = supabase.from("match_predictions").select("*");
  if (playerId) query = query.eq("player_id", playerId);
  const { data } = await query;
  return (data ?? []) as MatchPrediction[];
}

export interface CommunityMatchPick {
  playerId: string;
  displayName: string;
  avatarEmoji: string;
  predHomeScore: number;
  predAwayScore: number;
  predWinnerTeamId: string | null;
  podiumPicks?: PlayerPodiumDisplay | null;
  recentForm?: PickFormSlot[];
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

export async function getTournamentPodiumPredictions(): Promise<
  TournamentPodiumPrediction[]
> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("tournament_podium_predictions")
    .select("*");
  return (data ?? []) as TournamentPodiumPrediction[];
}

export async function getMyTournamentPodium(
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

export async function getBigPredictions(): Promise<BigPrediction[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from("big_predictions").select("*");
  return (data ?? []) as BigPrediction[];
}

export async function getFinalsPredictions(): Promise<FinalsChallengePrediction[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from("finals_challenge_predictions").select("*");
  return (data ?? []) as FinalsChallengePrediction[];
}

export async function getAdjustments(): Promise<ManualAdjustment[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from("manual_adjustments").select("*");
  return (data ?? []) as ManualAdjustment[];
}

export async function getActualResults(): Promise<ActualTournamentResults> {
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

/**
 * Rank movement = current rank vs the leaderboard as it stood before the
 * most recent day (ET) with final results. Those matches are reverted to
 * "scheduled" and the board re-ranked to get the previous order.
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
  const finalDates = matches
    .filter((m) => m.status === "final" && m.kickoff_at)
    .map((m) => matchDateKey(m.kickoff_at));
  const latestFinalDate = finalDates.sort().pop();

  if (!latestFinalDate) {
    return current.map((e) => ({ ...e, rankMovement: "same" as const }));
  }

  const priorMatches = matches.map((m) =>
    m.status === "final" && matchDateKey(m.kickoff_at) === latestFinalDate
      ? {
          ...m,
          status: "scheduled" as const,
          home_score: null,
          away_score: null,
          winner_team_id: null,
        }
      : m
  );

  const previous = calculateLeaderboard(
    players,
    priorMatches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    new Map(),
    teams
  );
  const prevRankByPlayer = new Map(previous.map((e) => [e.playerId, e.rank]));

  return current.map((entry) => {
    const prevRank = prevRankByPlayer.get(entry.playerId);
    const rankMovement =
      prevRank == null || prevRank === entry.rank
        ? ("same" as const)
        : prevRank > entry.rank
          ? ("up" as const)
          : ("down" as const);
    return { ...entry, rankMovement };
  });
}

async function finalizeCompletedMatches(matches: Match[]): Promise<number> {
  const supabase = getSupabase();
  let count = 0;
  for (const match of matches) {
    if (!shouldAutoFinalizeMatch(match)) continue;
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
  let matches = await getMatchesWithTeams();
  if (await finalizeCompletedMatches(matches)) {
    matches = await getMatchesWithTeams();
  }
  const [players, predictions, podiumPredictions, finalsPredictions, adjustments, actualResults, settings, teams] =
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

  const { ensureDefaultPredictionsForLockedMatches } = await import(
    "./defaultPredictions"
  );
  await ensureDefaultPredictionsForLockedMatches(
    matches,
    players,
    predictions
  );
  const scoredPredictions = await getPredictions();

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
  const sync = await syncLiveScores();
  const snapshot = await getLeaderboardData({ includeLiveScores: true });
  const matches = mergeLiveClocks(snapshot.matches, sync.liveClockByMatchId);
  const liveMatch = findLiveMatch(matches);
  return { sync, ...snapshot, matches, liveMatch };
}

export async function getPicksSnapshot(playerId: string) {
  let matches = await getMatchesWithTeams();
  let liveClockByMatchId: Record<string, string> | undefined;
  if (isAnyMatchInPlayWindow(matches)) {
    const { syncLiveScores } = await import("./scores/sync");
    const sync = await syncLiveScores();
    liveClockByMatchId = sync.liveClockByMatchId;
    matches = await getMatchesWithTeams();
  }

  matches = mergeLiveClocks(matches, liveClockByMatchId);
  const pickMatches = resolveMatchesForPicks(matches);
  const matchIds = pickMatches.map((m) => m.id);

  const [predictions, players, communityPicksByMatchId] = await Promise.all([
    getPredictions(playerId),
    getPlayers(),
    getConfirmedMatchPicksByMatchIds(matchIds),
  ]);

  const { ensureDefaultPredictionsForLockedMatches } = await import(
    "./defaultPredictions"
  );
  await ensureDefaultPredictionsForLockedMatches(
    pickMatches,
    players,
    predictions
  );
  const refreshedPredictions = await getPredictions(playerId);

  return {
    syncedAt: new Date().toISOString(),
    matches: pickMatches,
    predictions: refreshedPredictions,
    communityPicksByMatchId: Object.fromEntries(communityPicksByMatchId),
    totalPlayers: players.length,
    hasLiveScoring: hasAnyDisplayableLiveScore(matches),
  };
}

export async function recalculateAllScores(): Promise<void> {
  const supabase = getSupabase();
  const [matches, predictions, podiumPredictions, finalsPredictions, actualResults, settings, players, teams] =
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

  const { ensureDefaultPredictionsForLockedMatches } = await import(
    "./defaultPredictions"
  );
  await ensureDefaultPredictionsForLockedMatches(
    matches,
    players,
    predictions
  );

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
