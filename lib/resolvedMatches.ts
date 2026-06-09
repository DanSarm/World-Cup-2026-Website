import type { Match, MatchPrediction } from "./types";
import { buildKnockoutBracket } from "./knockoutBracket";
import { buildPickScoreMap, type PickScore } from "./groupStandings";
import { hasSavedPick } from "./pickUtils";

function savedPickScores(
  predictions: MatchPrediction[]
): Map<string, PickScore> {
  const map = new Map<string, PickScore>();
  for (const p of predictions) {
    if (!hasSavedPick(p)) continue;
    map.set(p.match_id, {
      home: p.pred_home_score,
      away: p.pred_away_score,
    });
  }
  return map;
}

/** Fill knockout match rows with teams once bracket slots are known. */
export function applyKnownKnockoutTeams(
  matches: Match[],
  predictions: MatchPrediction[]
): Match[] {
  const groupPickScores = buildPickScoreMap(
    matches,
    savedPickScores(predictions),
    new Map()
  );
  const bracket = buildKnockoutBracket(
    matches,
    groupPickScores,
    predictions
  );

  return matches.map((match) => {
    if (match.match_number < 73) return match;

    const slot = bracket.byNumber.get(match.match_number);
    if (!slot?.home.team || !slot?.away.team) return match;

    return {
      ...match,
      home_team_id: slot.home.team.teamId,
      away_team_id: slot.away.team.teamId,
      home_team: slot.home.team.team,
      away_team: slot.away.team.team,
      home_label: slot.home.team.team.name,
      away_label: slot.away.team.team.name,
    };
  });
}

/** Knockout fixtures only appear on picks once both teams are known. */
export function isMatchVisibleOnPicks(match: Match): boolean {
  if (match.stage === "group") return true;
  return !!(match.home_team_id && match.away_team_id);
}

export function resolveMatchesForPicks(
  matches: Match[],
  predictions: MatchPrediction[]
): Match[] {
  return applyKnownKnockoutTeams(matches, predictions).filter(
    isMatchVisibleOnPicks
  );
}
