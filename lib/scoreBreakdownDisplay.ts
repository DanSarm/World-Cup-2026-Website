import { isKnockoutStage } from "./types";
import type { Match } from "./types";
import type { ScoreMatchResult } from "./scoring";
import { EXACT_SCORE_BONUS } from "./scoreCloseness";

export function outcomeBonusLine(bonus: number): string | null {
  if (bonus <= 0) return null;
  return `Hard pick +${bonus}`;
}

export function formatMatchScoreBreakdownLines(
  match: Pick<Match, "stage">,
  result: Pick<
    ScoreMatchResult,
    "breakdown" | "exactScore" | "knockoutCorrect" | "correctResult" | "points"
  >
): string[] {
  if (result.breakdown.total <= 0 && result.points <= 0) {
    if (isKnockoutStage(match.stage)) {
      return ["Wrong advancer · 0"];
    }
    return ["Wrong result · 0"];
  }

  const { breakdown } = result;
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
  }

  if (breakdown.fireBonus > 0) {
    lines.push(`Fire bonus +${breakdown.fireBonus}`);
  }

  lines.push(`Total: ${breakdown.total}`);
  return lines;
}
