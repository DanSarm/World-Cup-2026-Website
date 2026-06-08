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
import { isConfirmedPick } from "./pickUtils";
import type {
  ActualTournamentResults,
  BigPrediction,
  FinalsChallengePrediction,
  LeaderboardEntry,
  ManualAdjustment,
  Match,
  MatchPrediction,
  Player,
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
}

export async function getConfirmedMatchPicks(
  matchId: string
): Promise<CommunityMatchPick[]> {
  const supabase = getSupabase();
  const primary = await supabase
    .from("match_predictions")
    .select(
      "player_id, pred_home_score, pred_away_score, pred_winner_team_id, pick_confirmed, players(display_name, avatar_emoji)"
    )
    .eq("match_id", matchId)
    .eq("pick_confirmed", true);

  let rows: unknown[] | null = primary.data;
  let error = primary.error;

  if (error?.message.includes("pick_confirmed")) {
    const fallback = await supabase
      .from("match_predictions")
      .select(
        "player_id, pred_home_score, pred_away_score, pred_winner_team_id, players(display_name, avatar_emoji)"
      )
      .eq("match_id", matchId);
    rows = fallback.data;
    error = fallback.error;
  }

  if (error || !rows) return [];

  type PlayerRef = { display_name: string; avatar_emoji: string | null };
  type Row = {
    player_id: string;
    pred_home_score: number;
    pred_away_score: number;
    pred_winner_team_id: string | null;
    pick_confirmed?: boolean;
    players: PlayerRef | PlayerRef[] | null;
  };

  const parsedRows = rows as Row[];

  return parsedRows
    .filter((row) => row.pick_confirmed !== false)
    .map((row) => {
      const player = Array.isArray(row.players) ? row.players[0] : row.players;
      if (!player) return null;
      return {
        playerId: row.player_id,
        displayName: player.display_name,
        avatarEmoji: player.avatar_emoji ?? "⚽",
        predHomeScore: row.pred_home_score,
        predAwayScore: row.pred_away_score,
        predWinnerTeamId: row.pred_winner_team_id,
      };
    })
    .filter((pick): pick is CommunityMatchPick => pick !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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

export async function getLeaderboardData(): Promise<{
  leaderboard: LeaderboardEntry[];
  finalsLeaderboard: ReturnType<typeof getFinalsChallengeLeaderboard>;
  settings: Awaited<ReturnType<typeof getSettings>>;
  players: Player[];
  matches: Match[];
}> {
  const [players, matches, predictions, podiumPredictions, finalsPredictions, adjustments, actualResults, settings] =
    await Promise.all([
      getPlayers(),
      getMatchesWithTeams(),
      getPredictions(),
      getTournamentPodiumPredictions(),
      getFinalsPredictions(),
      getAdjustments(),
      getActualResults(),
      getSettings(),
    ]);

  const tempLb = calculateLeaderboard(
    players,
    matches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    new Map()
  );

  const projectedPrizes = buildProjectedPrizes(
    players,
    tempLb,
    finalsPredictions,
    actualResults,
    settings
  );

  const leaderboard = calculateLeaderboard(
    players,
    matches,
    predictions,
    podiumPredictions,
    finalsPredictions,
    adjustments,
    settings,
    actualResults,
    projectedPrizes
  );

  const finalsLeaderboard = getFinalsChallengeLeaderboard(
    players,
    finalsPredictions,
    actualResults
  );

  return { leaderboard, finalsLeaderboard, settings, players, matches };
}

export async function recalculateAllScores(): Promise<void> {
  const supabase = getSupabase();
  const [matches, predictions, podiumPredictions, finalsPredictions, actualResults, settings] =
    await Promise.all([
      getMatchesWithTeams(),
      getPredictions(),
      getTournamentPodiumPredictions(),
      getFinalsPredictions(),
      getActualResults(),
      getSettings(),
    ]);

  const { scoringConfigFromSettings } = await import("./scoring");
  const scoringConfig = scoringConfigFromSettings(settings);

  for (const pred of predictions) {
    if (!isConfirmedPick(pred)) continue;
    const match = matches.find((m) => m.id === pred.match_id);
    if (!match) continue;
    const result = scoreMatchPrediction(match, pred, scoringConfig);
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

  for (const pp of podiumPredictions) {
    const points = calculatePodiumPoints(
      pp,
      actualResults,
      settings.champion_probabilities
    );
    await supabase
      .from("tournament_podium_predictions")
      .update({ points, updated_at: new Date().toISOString() })
      .eq("id", pp.id);
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
  biggestMover: { name: string; delta: number } | null;
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
    biggestMover: null,
  };
}
