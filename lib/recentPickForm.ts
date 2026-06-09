import { isConfirmedPick, getEffectiveMatchPrediction } from "./pickUtils";
import { scoreMatchPrediction } from "./scoring";
import type { ScoringConfig } from "./scoringConfig";
import type { Match, MatchPrediction, PickFormResult, PickFormSlot } from "./types";

export type { PickFormResult, PickFormSlot };

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

  const finalMatches = matches
    .filter((m) => m.status === "final")
    .sort((a, b) => a.match_number - b.match_number);

  const results: PickFormResult[] = [];
  for (const match of finalMatches) {
    const pred = getEffectiveMatchPrediction(
      match,
      predByMatchId.get(match.id)
    );
    if (!pred) continue;
    const result = classifyPickResult(match, pred, scoringConfig);
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
