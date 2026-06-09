import {
  computeGroupProjections,
  type GroupProjection,
  type GroupStandingRow,
  type PickScore,
} from "./groupStandings";
import { THIRD_PLACE_COMBINATIONS, type WinnerSlot } from "./thirdPlaceCombinations";
import { GROUP_LETTERS, type Match, type MatchPrediction, type Team } from "./types";
import { hasSavedPick } from "./pickUtils";
import { getActualMatchScore } from "./matchResults";

export interface BracketTeam {
  teamId: string;
  team: Team;
  label?: string;
}

export interface BracketSlot {
  team: BracketTeam | null;
  placeholder?: string;
}

export interface BracketMatchView {
  matchNumber: number;
  stage: Match["stage"];
  home: BracketSlot;
  away: BracketSlot;
  winnerId: string | null;
  hasPick: boolean;
  /** True when the winner comes from a real final/live score. */
  isActualResult: boolean;
}

export interface KnockoutBracketView {
  matches: BracketMatchView[];
  byNumber: Map<number, BracketMatchView>;
  rounds: BracketRound[];
  qualifyingThirdGroups: string[];
}

export interface BracketRound {
  key: string;
  label: string;
  matchNumbers: number[];
}

const WINNER_SLOTS: WinnerSlot[] = ["A", "B", "D", "E", "G", "I", "K", "L"];

const THIRD_PLACE_MATCH_SLOT: Record<number, WinnerSlot> = {
  74: "E",
  77: "I",
  79: "A",
  80: "L",
  81: "D",
  82: "G",
  85: "B",
  87: "K",
};

type SlotRef =
  | { kind: "group"; letter: string; rank: 1 | 2 | 3 }
  | { kind: "third"; slot: WinnerSlot }
  | { kind: "winner"; matchNumber: number }
  | { kind: "loser"; matchNumber: number };

const MATCH_SLOTS: Record<number, { home: SlotRef; away: SlotRef }> = {
  73: { home: { kind: "group", letter: "A", rank: 2 }, away: { kind: "group", letter: "B", rank: 2 } },
  74: { home: { kind: "group", letter: "E", rank: 1 }, away: { kind: "third", slot: "E" } },
  75: { home: { kind: "group", letter: "F", rank: 1 }, away: { kind: "group", letter: "C", rank: 2 } },
  76: { home: { kind: "group", letter: "C", rank: 1 }, away: { kind: "group", letter: "F", rank: 2 } },
  77: { home: { kind: "group", letter: "I", rank: 1 }, away: { kind: "third", slot: "I" } },
  78: { home: { kind: "group", letter: "E", rank: 2 }, away: { kind: "group", letter: "I", rank: 2 } },
  79: { home: { kind: "group", letter: "A", rank: 1 }, away: { kind: "third", slot: "A" } },
  80: { home: { kind: "group", letter: "L", rank: 1 }, away: { kind: "third", slot: "L" } },
  81: { home: { kind: "group", letter: "D", rank: 1 }, away: { kind: "third", slot: "D" } },
  82: { home: { kind: "group", letter: "G", rank: 1 }, away: { kind: "third", slot: "G" } },
  83: { home: { kind: "group", letter: "K", rank: 2 }, away: { kind: "group", letter: "L", rank: 2 } },
  84: { home: { kind: "group", letter: "H", rank: 1 }, away: { kind: "group", letter: "J", rank: 2 } },
  85: { home: { kind: "group", letter: "B", rank: 1 }, away: { kind: "third", slot: "B" } },
  86: { home: { kind: "group", letter: "J", rank: 1 }, away: { kind: "group", letter: "H", rank: 2 } },
  87: { home: { kind: "group", letter: "K", rank: 1 }, away: { kind: "third", slot: "K" } },
  88: { home: { kind: "group", letter: "D", rank: 2 }, away: { kind: "group", letter: "G", rank: 2 } },
  89: { home: { kind: "winner", matchNumber: 74 }, away: { kind: "winner", matchNumber: 77 } },
  90: { home: { kind: "winner", matchNumber: 73 }, away: { kind: "winner", matchNumber: 75 } },
  91: { home: { kind: "winner", matchNumber: 76 }, away: { kind: "winner", matchNumber: 78 } },
  92: { home: { kind: "winner", matchNumber: 79 }, away: { kind: "winner", matchNumber: 80 } },
  93: { home: { kind: "winner", matchNumber: 83 }, away: { kind: "winner", matchNumber: 84 } },
  94: { home: { kind: "winner", matchNumber: 81 }, away: { kind: "winner", matchNumber: 82 } },
  95: { home: { kind: "winner", matchNumber: 86 }, away: { kind: "winner", matchNumber: 88 } },
  96: { home: { kind: "winner", matchNumber: 85 }, away: { kind: "winner", matchNumber: 87 } },
  97: { home: { kind: "winner", matchNumber: 89 }, away: { kind: "winner", matchNumber: 90 } },
  98: { home: { kind: "winner", matchNumber: 93 }, away: { kind: "winner", matchNumber: 94 } },
  99: { home: { kind: "winner", matchNumber: 91 }, away: { kind: "winner", matchNumber: 92 } },
  100: { home: { kind: "winner", matchNumber: 95 }, away: { kind: "winner", matchNumber: 96 } },
  101: { home: { kind: "winner", matchNumber: 97 }, away: { kind: "winner", matchNumber: 98 } },
  102: { home: { kind: "winner", matchNumber: 99 }, away: { kind: "winner", matchNumber: 100 } },
  103: { home: { kind: "loser", matchNumber: 101 }, away: { kind: "loser", matchNumber: 102 } },
  104: { home: { kind: "winner", matchNumber: 101 }, away: { kind: "winner", matchNumber: 102 } },
};

const KNOCKOUT_ORDER = [
  73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
  89, 90, 91, 92, 93, 94, 95, 96,
  97, 98, 99, 100,
  101, 102,
  103, 104,
];

/** Visual tree: left & right halves meet at the center final. */
export const BRACKET_TREE = {
  rows: 8,
  left: {
    r32: [73, 75, 74, 77, 83, 84, 81, 82],
    r16: [90, 89, 93, 94],
    qf: [97, 98],
    sf: [101],
  },
  right: {
    r32: [76, 78, 79, 80, 86, 88, 85, 87],
    r16: [91, 92, 95, 96],
    qf: [99, 100],
    sf: [102],
  },
  center: {
    final: 104,
    third: 103,
  },
} as const;

export const BRACKET_ROUNDS: BracketRound[] = [
  {
    key: "round_of_32",
    label: "Round of 32",
    matchNumbers: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
  },
  {
    key: "round_of_16",
    label: "Round of 16",
    matchNumbers: [89, 90, 91, 92, 93, 94, 95, 96],
  },
  {
    key: "quarterfinal",
    label: "Quarter-finals",
    matchNumbers: [97, 98, 99, 100],
  },
  {
    key: "semifinal",
    label: "Semi-finals",
    matchNumbers: [101, 102],
  },
  {
    key: "finals",
    label: "Final",
    matchNumbers: [104],
  },
  {
    key: "third_place",
    label: "3rd Place",
    matchNumbers: [103],
  },
];

interface ThirdPlaceCandidate {
  letter: string;
  row: GroupStandingRow;
}

function rowAtRank(group: GroupProjection | undefined, rank: number): GroupStandingRow | null {
  return group?.rows.find((r) => r.rank === rank) ?? null;
}

function toBracketTeam(row: GroupStandingRow, label?: string): BracketTeam {
  return { teamId: row.teamId, team: row.team, label };
}

function rankThirdPlaceTeams(groups: GroupProjection[]): ThirdPlaceCandidate[] {
  const candidates: ThirdPlaceCandidate[] = [];

  for (const letter of GROUP_LETTERS) {
    const group = groups.find((g) => g.letter === letter);
    const third = rowAtRank(group, 3);
    if (third) candidates.push({ letter, row: third });
  }

  return candidates.sort((a, b) => {
    const ar = a.row;
    const br = b.row;
    if (br.points !== ar.points) return br.points - ar.points;
    if (br.goalDiff !== ar.goalDiff) return br.goalDiff - ar.goalDiff;
    if (br.goalsFor !== ar.goalsFor) return br.goalsFor - ar.goalsFor;
    return a.letter.localeCompare(b.letter);
  });
}

function lookupThirdPlaceMapping(qualifyingLetters: string[]) {
  const key = [...qualifyingLetters].sort().join("");
  return THIRD_PLACE_COMBINATIONS[key] ?? null;
}

function resolveThirdPlaceTeam(
  slot: WinnerSlot,
  qualifying: ThirdPlaceCandidate[],
  mapping: Record<WinnerSlot, string>
): BracketTeam | null {
  const sourceLetter = mapping[slot];
  const candidate = qualifying.find((c) => c.letter === sourceLetter);
  if (!candidate) return null;
  return toBracketTeam(candidate.row, `3rd Gr. ${sourceLetter}`);
}

function slotPlaceholder(ref: SlotRef): string {
  switch (ref.kind) {
    case "group":
      return ref.rank === 1
        ? `Gr. ${ref.letter} winner`
        : ref.rank === 2
          ? `Gr. ${ref.letter} 2nd`
          : `Gr. ${ref.letter} 3rd`;
    case "third":
      return `3rd (${ref.slot})`;
    case "winner":
      return `W${ref.matchNumber}`;
    case "loser":
      return `L${ref.matchNumber}`;
  }
}

function resolveSlot(
  ref: SlotRef,
  groupsByLetter: Map<string, GroupProjection>,
  qualifyingThird: ThirdPlaceCandidate[],
  thirdMapping: Record<WinnerSlot, string> | null,
  winners: Map<number, BracketTeam>,
  losers: Map<number, BracketTeam>
): BracketSlot {
  if (ref.kind === "group") {
    const group = groupsByLetter.get(ref.letter);
    const row = rowAtRank(group, ref.rank);
    if (row) {
      return {
        team: toBracketTeam(
          row,
          ref.rank === 1 ? `Gr. ${ref.letter}` : ref.rank === 2 ? `2nd ${ref.letter}` : `3rd ${ref.letter}`
        ),
      };
    }
    return { team: null, placeholder: slotPlaceholder(ref) };
  }

  if (ref.kind === "third") {
    if (!thirdMapping) {
      return { team: null, placeholder: "Best 3rd place" };
    }
    const team = resolveThirdPlaceTeam(ref.slot, qualifyingThird, thirdMapping);
    return team
      ? { team }
      : { team: null, placeholder: `3rd (${thirdMapping[ref.slot]})` };
  }

  if (ref.kind === "winner") {
    const team = winners.get(ref.matchNumber);
    return team ? { team } : { team: null, placeholder: slotPlaceholder(ref) };
  }

  const team = losers.get(ref.matchNumber);
  return team ? { team } : { team: null, placeholder: slotPlaceholder(ref) };
}

interface KnockoutPick extends PickScore {
  pred_winner_team_id: string | null;
}

function resolveMatchWinner(
  match: Match | undefined,
  home: BracketTeam | null,
  away: BracketTeam | null,
  pick: KnockoutPick | undefined
): { winner: BracketTeam | null; fromActual: boolean } {
  if (!home || !away) return { winner: null, fromActual: false };

  const actual = match ? getActualMatchScore(match) : null;
  if (actual) {
    if (match?.winner_team_id) {
      const winner =
        match.winner_team_id === home.teamId
          ? home
          : match.winner_team_id === away.teamId
            ? away
            : null;
      return { winner, fromActual: !!winner };
    }
    if (actual.home > actual.away) return { winner: home, fromActual: true };
    if (actual.away > actual.home) return { winner: away, fromActual: true };
    return { winner: null, fromActual: true };
  }

  if (!pick) return { winner: null, fromActual: false };

  if (pick.home > pick.away) return { winner: home, fromActual: false };
  if (pick.away > pick.home) return { winner: away, fromActual: false };
  if (pick.pred_winner_team_id === home.teamId) {
    return { winner: home, fromActual: false };
  }
  if (pick.pred_winner_team_id === away.teamId) {
    return { winner: away, fromActual: false };
  }
  return { winner: null, fromActual: false };
}

export function buildKnockoutBracket(
  matches: Match[],
  groupPickScores: Map<string, PickScore>,
  predictions: MatchPrediction[]
): KnockoutBracketView {
  const groups = computeGroupProjections(matches, groupPickScores);
  const groupsByLetter = new Map(groups.map((g) => [g.letter, g]));

  const allThird = rankThirdPlaceTeams(groups);
  const qualifyingThird = allThird.slice(0, 8);
  const qualifyingLetters = qualifyingThird.map((c) => c.letter);
  const thirdMapping = lookupThirdPlaceMapping(qualifyingLetters);

  const matchByNumber = new Map(
    matches.filter((m) => m.match_number >= 73).map((m) => [m.match_number, m])
  );

  const pickByMatchId = new Map<string, MatchPrediction>();
  for (const p of predictions) {
    if (hasSavedPick(p)) pickByMatchId.set(p.match_id, p);
  }

  const winners = new Map<number, BracketTeam>();
  const losers = new Map<number, BracketTeam>();
  const views: BracketMatchView[] = [];
  const byNumber = new Map<number, BracketMatchView>();

  for (const matchNumber of KNOCKOUT_ORDER) {
    const slots = MATCH_SLOTS[matchNumber];
    if (!slots) continue;

    const dbMatch = matchByNumber.get(matchNumber);
    const pick = dbMatch ? pickByMatchId.get(dbMatch.id) : undefined;
    const knockoutPick: KnockoutPick | undefined = pick
      ? {
          home: pick.pred_home_score,
          away: pick.pred_away_score,
          pred_winner_team_id: pick.pred_winner_team_id,
        }
      : undefined;

    const homeSlot = resolveSlot(
      slots.home,
      groupsByLetter,
      qualifyingThird,
      thirdMapping,
      winners,
      losers
    );
    const awaySlot = resolveSlot(
      slots.away,
      groupsByLetter,
      qualifyingThird,
      thirdMapping,
      winners,
      losers
    );

    const homeTeam = homeSlot.team;
    const awayTeam = awaySlot.team;
    const { winner, fromActual } = resolveMatchWinner(
      dbMatch,
      homeTeam,
      awayTeam,
      knockoutPick
    );

    const view: BracketMatchView = {
      matchNumber,
      stage: dbMatch?.stage ?? inferStage(matchNumber),
      home: homeSlot,
      away: awaySlot,
      winnerId: winner?.teamId ?? null,
      hasPick: !!knockoutPick,
      isActualResult: fromActual,
    };

    views.push(view);
    byNumber.set(matchNumber, view);

    if (winner && homeTeam && awayTeam) {
      winners.set(matchNumber, winner);
      const loser = winner.teamId === homeTeam.teamId ? awayTeam : homeTeam;
      losers.set(matchNumber, loser);
    }
  }

  return {
    matches: views,
    byNumber,
    rounds: BRACKET_ROUNDS,
    qualifyingThirdGroups: qualifyingLetters,
  };
}

function inferStage(matchNumber: number): Match["stage"] {
  if (matchNumber <= 88) return "round_of_32";
  if (matchNumber <= 96) return "round_of_16";
  if (matchNumber <= 100) return "quarterfinal";
  if (matchNumber <= 102) return "semifinal";
  if (matchNumber === 103) return "third_place";
  return "final";
}

export { THIRD_PLACE_MATCH_SLOT, WINNER_SLOTS };
