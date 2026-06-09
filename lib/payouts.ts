import type { LeaderboardEntry, PayoutPercentages, Settings } from "./types";
import { getFinalsChallengeLeaderboard } from "./scoring";
import type {
  ActualTournamentResults,
  FinalsChallengePrediction,
  Player,
} from "./types";

/** Each paid player contributes this amount to the prize pool. */
export const POOL_ENTRY_FEE = 50;

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

export function calculateProjectedPrizes(
  leaderboard: LeaderboardEntry[],
  _finalsLeaderboard: Array<{ playerId: string; rank: number }>,
  _settings: Settings,
  paidCount: number
): Map<string, number> {
  const pot = calculatePrizePool(paidCount);
  const prizes = new Map<string, number>();

  const paidLeaderboard = [...leaderboard]
    .filter((entry) => entry.paid)
    .sort((a, b) => b.totalPoints - a.totalPoints);

  for (let rank = 1; rank <= 4; rank++) {
    const entry = paidLeaderboard[rank - 1];
    const percent = paidPayoutPercent(rank);
    if (entry && percent > 0) {
      prizes.set(entry.playerId, calculatePrizeAmount(pot, percent));
    }
  }

  return prizes;
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
