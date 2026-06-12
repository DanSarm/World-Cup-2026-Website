import { isKnockoutStage, type Match } from "./types";
import { resolveGroupOutcomeBonuses } from "./odds/math";
import {
  previewPickRewards,
  DEFAULT_SCORING_CONFIG,
} from "./scoringConfig";

export type { PickRewardPreview, ScoringConfig } from "./scoringConfig";
export {
  previewPickRewards,
  DEFAULT_SCORING_CONFIG,
} from "./scoringConfig";

export interface BonusPill {
  label: string;
}

/** User-facing bonus pills — no odds or probabilities. */
export function getBonusPills(match: Match): BonusPill[] {
  const pills: BonusPill[] = [];

  if (isKnockoutStage(match.stage)) {
    if ((match.home_advance_bonus ?? 0) > 0) {
      pills.push({
        label: `${shortLabel(match.home_team?.short_name, match.home_label)} +${match.home_advance_bonus}`,
      });
    }
    if ((match.away_advance_bonus ?? 0) > 0) {
      pills.push({
        label: `${shortLabel(match.away_team?.short_name, match.away_label)} +${match.away_advance_bonus}`,
      });
    }
  } else {
    const bonuses = resolveGroupOutcomeBonuses(match);
    if (bonuses.home > 0) {
      pills.push({
        label: `${shortLabel(match.home_team?.short_name, match.home_label)} +${bonuses.home}`,
      });
    }
    if (bonuses.draw > 0) {
      pills.push({ label: `Draw +${bonuses.draw}` });
    }
    if (bonuses.away > 0) {
      pills.push({
        label: `${shortLabel(match.away_team?.short_name, match.away_label)} +${bonuses.away}`,
      });
    }
  }

  return pills;
}

export function hasAnyBonus(match: Match): boolean {
  return getBonusPills(match).length > 0;
}

function shortLabel(shortName?: string, fallback?: string): string {
  const name = shortName ?? fallback ?? "Team";
  return name.length > 14 ? name.slice(0, 12) + "…" : name;
}

/** Label for outcome-only points on the pick card (e.g. "if MEX wins"). */
export function outcomePreviewLabel(
  match: Match,
  predHome: number,
  predAway: number,
  predWinnerTeamId?: string | null
): string {
  if (isKnockoutStage(match.stage)) {
    if (predHome === predAway) {
      const team =
        predWinnerTeamId === match.home_team_id
          ? match.home_team
          : predWinnerTeamId === match.away_team_id
            ? match.away_team
            : null;
      const code = team?.fifa_code ?? "team";
      return `if ${code} advances`;
    }
    const team = predHome > predAway ? match.home_team : match.away_team;
    return `if ${team?.fifa_code ?? "winner"} advances`;
  }

  if (predHome === predAway) return "if draw";
  const team = predHome > predAway ? match.home_team : match.away_team;
  return `if ${team?.fifa_code ?? "winner"} wins`;
}

export const BONUS_ADMIN_GUIDE = [
  { label: "Even match", home: 0, draw: 0, away: 0, homeAdv: 0, awayAdv: 0 },
  { label: "Sneaky pick", home: 0, draw: 1, away: 1, homeAdv: 0, awayAdv: 1 },
  { label: "Brave pick", home: 0, draw: 2, away: 2, homeAdv: 0, awayAdv: 2 },
  { label: "Shock pick", home: 0, draw: 4, away: 4, homeAdv: 0, awayAdv: 4 },
  { label: "Miracle pick", home: 0, draw: 6, away: 6, homeAdv: 0, awayAdv: 6 },
  { label: "Impossible pick", home: 0, draw: 8, away: 8, homeAdv: 0, awayAdv: 8 },
] as const;

/** @deprecated use previewPickRewards */
export function projectPickPoints(
  match: Match,
  predHome: number,
  predAway: number,
  predWinnerId?: string | null,
  config: import("./scoringConfig").ScoringConfig = DEFAULT_SCORING_CONFIG
) {
  const preview = previewPickRewards(
    match,
    predHome,
    predAway,
    config,
    predWinnerId
  );
  return {
    resultPoints: preview.resultOnlyPoints,
    exactPoints: preview.maxPoints,
  };
}
