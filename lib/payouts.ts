import type { LeaderboardEntry, PayoutPercentages, Settings } from "./types";
import { getFinalsChallengeLeaderboard } from "./scoring";
import { assignCompetitionRanks } from "./competitionRank";
import type {
  ActualTournamentResults,
  FinalsChallengePrediction,
  Player,
} from "./types";

/** Each paid player contributes this amount to the prize pool. */
export const POOL_ENTRY_FEE = 50;

export const MAX_PRIZE_RANK = 4;

export function paidPayoutPercent(rank: number): number {
  switch (rank) {
    case 1:
      return 55;
    case 2:
      return 25;
    case 3:
      return 15;
    case 4:
      return 5;
    default:
      return 0;
  }
}

export function calculatePrizePool(paidCount: number): number {
  return POOL_ENTRY_FEE * paidCount;
}

/** @deprecated Use calculatePrizePool — kept for legacy callers. */
export function calculatePot(buyIn: number, paidCount: number): number {
  return buyIn * paidCount;
}

export function calculatePrizeAmount(
  pot: number,
  percentage: number
): number {
  return Math.round(pot * (percentage / 100) * 100) / 100;
}

export interface RankedPrizeEntry {
  playerId: string;
  rank: number;
}

/**
 * Only ranks 1–4 earn prize money (split among ties at each rank).
 * If every paid player is tied for 1st, split the entire pool equally.
 */
export function distributeRankedPrizes(
  rankedEntries: RankedPrizeEntry[],
  prizePool: number
): Map<string, number> {
  const prizes = new Map<string, number>();
  if (!rankedEntries.length || prizePool <= 0) return prizes;

  const allTiedForFirst =
    rankedEntries.length > 0 &&
    rankedEntries.every((entry) => entry.rank === 1);

  if (allTiedForFirst) {
    const share = calculatePrizeAmount(
      prizePool,
      100 / rankedEntries.length
    );
    for (const entry of rankedEntries) {
      prizes.set(entry.playerId, share);
    }
    return prizes;
  }

  for (let rank = 1; rank <= MAX_PRIZE_RANK; rank++) {
    const tied = rankedEntries.filter((entry) => entry.rank === rank);
    if (!tied.length) continue;

    const poolPercent = paidPayoutPercent(rank);
    if (poolPercent <= 0) continue;

    const share = calculatePrizeAmount(prizePool, poolPercent / tied.length);
    for (const entry of tied) {
      prizes.set(entry.playerId, share);
    }
  }

  return prizes;
}

export function calculateProjectedPrizes(
  leaderboard: LeaderboardEntry[],
  _finalsLeaderboard: Array<{ playerId: string; rank: number }>,
  _settings: Settings,
  paidCount: number
): Map<string, number> {
  const pot = calculatePrizePool(paidCount);

  const paidLeaderboard = assignCompetitionRanks(
    [...leaderboard]
      .filter((entry) => entry.paid)
      .sort((a, b) => b.totalPoints - a.totalPoints),
    (entry) => entry.totalPoints
  );

  return distributeRankedPrizes(paidLeaderboard, pot);
}

export function buildProjectedPrizes(
  players: Player[],
  leaderboard: LeaderboardEntry[],
  finalsPredictions: FinalsChallengePrediction[],
  actualResults: ActualTournamentResults,
  settings: Settings
): Map<string, number> {
  const paidCount = players.filter((p) => p.paid).length;
  const finalsLb = getFinalsChallengeLeaderboard(
    players,
    finalsPredictions,
    actualResults
  );
  return calculateProjectedPrizes(leaderboard, finalsLb, settings, paidCount);
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function validatePayoutTotal(pct: PayoutPercentages): boolean {
  return (
    pct.overall_first +
      pct.overall_second +
      pct.overall_third +
      pct.exact_score +
      pct.finals_challenge +
      pct.fun_prize ===
    100
  );
}
