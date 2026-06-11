import { isConfirmedPick, getEffectiveMatchPrediction } from "./pickUtils";
import { scoreMatchPrediction } from "./scoring";
import type { ScoringConfig } from "./scoringConfig";
import { hasDisplayableLiveScore } from "./matchLive";
import type {
  Match,
  MatchPrediction,
  PickFormResult,
  PickFormSlot,
} from "./types";

export type { PickFormResult, PickFormSlot };

type PickScores =
  | Pick<MatchPrediction, "pred_home_score" | "pred_away_score">
  | { predHomeScore: number; predAwayScore: number };

function pickScores(prediction: PickScores): {
  predHome: number;
  predAway: number;
} {
  if ("predHomeScore" in prediction) {
    return {
      predHome: prediction.predHomeScore,
      predAway: prediction.predAwayScore,
    };
  }
  return {
    predHome: prediction.pred_home_score,
    predAway: prediction.pred_away_score,
  };
}

export function isPickExactImpossible(
  match: Pick<Match, "home_score" | "away_score">,
  prediction: PickScores
): boolean {
  if (match.home_score == null || match.away_score == null) return false;
  const { predHome, predAway } = pickScores(prediction);
  return match.home_score > predHome || match.away_score > predAway;
}

export function classifyPickResult(
  match: Match,
  prediction: Pick<
    MatchPrediction,
    "pred_home_score" | "pred_away_score" | "pred_winner_team_id"
  >,
  scoringConfig: ScoringConfig
): PickFormResult | null {
  if (match.status !== "final") return null;

  const scored = scoreMatchPrediction(match, prediction, scoringConfig);
  if (!scored.correctResult) return "wrong";
  if (scored.exactScore) return "exact";
  return "correct";
}

export function predictedMatchResult(
  predHome: number,
  predAway: number
): "home" | "away" | "draw" {
  if (predHome > predAway) return "home";
  if (predAway > predHome) return "away";
  return "draw";
}

function currentMatchResult(
  home: number,
  away: number
): "home" | "away" | "draw" {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function classifyLivePickResult(
  match: Match,
  prediction: Pick<
    MatchPrediction,
    "pred_home_score" | "pred_away_score" | "pred_winner_team_id"
  >,
  scoringConfig: ScoringConfig
): PickFormResult | null {
  if (!hasDisplayableLiveScore(match)) return null;

  const home = match.home_score!;
  const away = match.away_score!;
  const predHome = prediction.pred_home_score;
  const predAway = prediction.pred_away_score;

  if (home === predHome && away === predAway) return "live-exact";

  const predResult = predictedMatchResult(predHome, predAway);
  const liveResult = currentMatchResult(home, away);

  if (
    liveResult !== "draw" &&
    predResult !== "draw" &&
    predResult !== liveResult
  ) {
    return "live-wrong";
  }

  const exactImpossible = isPickExactImpossible(match, prediction);
  const scored = scoreMatchPrediction(match, prediction, scoringConfig, {
    allowLive: true,
  });

  if (exactImpossible && !scored.correctResult) return "live-wrong";
  if (scored.correctResult) return "live-correct";
  return "live-pending";
}

export function isPickLiveEliminated(
  match: Match,
  prediction: Pick<
    MatchPrediction,
    "pred_home_score" | "pred_away_score" | "pred_winner_team_id"
  >,
  scoringConfig: ScoringConfig
): boolean {
  return classifyLivePickResult(match, prediction, scoringConfig) === "live-wrong";
}

/** Rightmost dot = live status for the match card currently in progress. */
export function withLiveFormSlot(
  form: PickFormSlot[],
  match: Match,
  prediction: Pick<
    MatchPrediction,
    "pred_home_score" | "pred_away_score" | "pred_winner_team_id"
  >,
  scoringConfig: ScoringConfig
): PickFormSlot[] {
  const live = classifyLivePickResult(match, prediction, scoringConfig);
  if (!live) return form;

  const slots: PickFormSlot[] =
    form.length === 5
      ? [...form]
      : ([...Array(5 - form.length).fill(null), ...form] as PickFormSlot[]);
  slots[4] = live;
  return slots;
}

export function buildPlayerRecentForm(
  playerId: string,
  matches: Match[],
  predictions: MatchPrediction[],
  scoringConfig: ScoringConfig,
  count = 5
): PickFormSlot[] {
  const predByMatchId = new Map(
    predictions
      .filter((p) => p.player_id === playerId && isConfirmedPick(p))
      .map((p) => [p.match_id, p])
  );

  const resultMatches = matches
    .filter((m) => m.status === "final" || hasDisplayableLiveScore(m))
    .sort((a, b) => a.match_number - b.match_number);

  const results: PickFormResult[] = [];
  for (const match of resultMatches) {
    const pred = getEffectiveMatchPrediction(
      match,
      predByMatchId.get(match.id)
    );
    if (!pred) continue;
    const result =
      match.status === "final"
        ? classifyPickResult(match, pred, scoringConfig)
        : classifyLivePickResult(match, pred, scoringConfig);
    if (result) results.push(result);
  }

  const recent = results.slice(-count);
  return [...Array(Math.max(0, count - recent.length)).fill(null), ...recent];
}

export function buildRecentFormByPlayer(
  playerIds: string[],
  matches: Match[],
  predictions: MatchPrediction[],
  scoringConfig: ScoringConfig
): Map<string, PickFormSlot[]> {
  const map = new Map<string, PickFormSlot[]>();
  for (const id of playerIds) {
    map.set(id, buildPlayerRecentForm(id, matches, predictions, scoringConfig));
  }
  return map;
}
