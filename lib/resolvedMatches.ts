import type { Match } from "./types";
import {
  buildKnockoutBracket,
  MATCH_SLOTS,
  type SlotRef,
} from "./knockoutBracket";
import { buildStandingsScoreMap } from "./groupStandings";
import { isGroupMatchFinalized } from "./matchResults";

function isGroupComplete(matches: Match[], letter: string): boolean {
  const groupMatches = matches.filter(
    (m) => m.stage === "group" && m.group_letter === letter
  );
  return (
    groupMatches.length > 0 &&
    groupMatches.every(isGroupMatchFinalized)
  );
}

function allGroupsComplete(matches: Match[]): boolean {
  const groupMatches = matches.filter((m) => m.stage === "group");
  return (
    groupMatches.length > 0 && groupMatches.every(isGroupMatchFinalized)
  );
}

function isKnockoutSourceFinalized(match: Match | undefined): boolean {
  if (!match) return false;
  if (match.status === "final") return true;
  if (
    match.status === "locked" &&
    match.home_score != null &&
    match.away_score != null &&
    match.home_score !== match.away_score
  ) {
    return true;
  }
  return false;
}

/**
 * A bracket slot is only truly known once real results decide it:
 * group ranks need the whole group finished, third-place qualifiers
 * need every group finished, and winner/loser slots need the source
 * knockout match to be final.
 */
function isSlotDetermined(
  ref: SlotRef,
  matches: Match[],
  matchesByNumber: Map<number, Match>
): boolean {
  switch (ref.kind) {
    case "group":
      return isGroupComplete(matches, ref.letter);
    case "third":
      return allGroupsComplete(matches);
    case "winner":
    case "loser": {
      const source = matchesByNumber.get(ref.matchNumber);
      return isKnockoutSourceFinalized(source);
    }
  }
}

function knockoutSlotsAreDetermined(
  matchNumber: number,
  matches: Match[],
  matchesByNumber: Map<number, Match>
): boolean {
  const slots = MATCH_SLOTS[matchNumber];
  if (!slots) return false;
  return (
    isSlotDetermined(slots.home, matches, matchesByNumber) &&
    isSlotDetermined(slots.away, matches, matchesByNumber)
  );
}

function hasAssignedTeams(match: Match): boolean {
  return !!(
    match.home_team_id &&
    match.away_team_id &&
    match.home_team &&
    match.away_team
  );
}

/**
 * Fill knockout match rows with teams once bracket slots are decided by
 * actual results. Never resolves from anyone's predictions, so upcoming
 * knockout matchups stay hidden until they are genuinely known.
 */
export function applyKnownKnockoutTeams(matches: Match[]): Match[] {
  const actualScores = buildStandingsScoreMap(matches);
  const bracket = buildKnockoutBracket(matches, actualScores, []);

  const matchesByNumber = new Map(matches.map((m) => [m.match_number, m]));

  return matches.map((match) => {
    if (match.match_number < 73) return match;

    if (hasAssignedTeams(match)) return match;

    if (!knockoutSlotsAreDetermined(match.match_number, matches, matchesByNumber)) {
      return match;
    }

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

export function resolveMatchesForPicks(matches: Match[]): Match[] {
  return applyKnownKnockoutTeams(matches).filter(isMatchVisibleOnPicks);
}
