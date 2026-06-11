import { isKnockoutStage } from "./types";
import type { Match } from "./types";
import type { ScoreMatchResult } from "./scoring";
import { EXACT_SCORE_BONUS } from "./scoreCloseness";

export function outcomeBonusLine(bonus: number): string | null {
  if (bonus <= 0) return null;
  if (bonus >= 6) return `Miracle bonus +${bonus}`;
  return `Hard pick bonus +${bonus}`;
}

export function formatMatchScoreBreakdownLines(
  match: Pick<Match, "stage">,
  result: Pick<
    ScoreMatchResult,
    "breakdown" | "exactScore" | "knockoutCorrect" | "correctResult"
  >,
  scoreError: number
): string[] {
  const { breakdown } = result;
  if (breakdown.total <= 0) return [];

  const lines: string[] = [];

  if (isKnockoutStage(match.stage)) {
    if (breakdown.basePoints > 0) {
      lines.push(`Correct advancer +${breakdown.basePoints}`);
    }
  } else if (breakdown.basePoints > 0) {
    lines.push(`Correct result +${breakdown.basePoints}`);
  }

  const hardPick = outcomeBonusLine(breakdown.outcomeBonus);
  if (hardPick) lines.push(hardPick);

  if (result.exactScore) {
    lines.push(`Exact score +${EXACT_SCORE_BONUS}`);
  } else if (breakdown.scoreClosenessBonus > 0) {
    if (scoreError === 1) lines.push("One goal off +2");
    else if (scoreError === 2) lines.push("Two goals off +1");
  }

  if (breakdown.fireBonus > 0) {
    lines.push(`Fire bonus +${breakdown.fireBonus}`);
  }

  lines.push(`Total: ${breakdown.total}`);
  return lines;
}
