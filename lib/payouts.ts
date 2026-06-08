import type { LeaderboardEntry, PayoutPercentages, Settings } from "./types";
import { getFinalsChallengeLeaderboard } from "./scoring";
import type {
  ActualTournamentResults,
  FinalsChallengePrediction,
  Player,
} from "./types";

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
  finalsLeaderboard: Array<{ playerId: string; rank: number }>,
  settings: Settings,
  paidCount: number
): Map<string, number> {
  const pot = calculatePot(settings.buy_in, paidCount);
  const pct = settings.payout_percentages;
  const prizes = new Map<string, number>();

  const addPrize = (playerId: string, amount: number) => {
    prizes.set(playerId, (prizes.get(playerId) ?? 0) + amount);
  };

  const first = leaderboard.find((e) => e.rank === 1);
  const second = leaderboard.find((e) => e.rank === 2);
  const third = leaderboard.find((e) => e.rank === 3);

  if (first) addPrize(first.playerId, calculatePrizeAmount(pot, pct.overall_first));
  if (second) addPrize(second.playerId, calculatePrizeAmount(pot, pct.overall_second));
  if (third) addPrize(third.playerId, calculatePrizeAmount(pot, pct.overall_third));

  const maxExact = Math.max(...leaderboard.map((e) => e.exactScores), 0);
  if (maxExact > 0) {
    const exactWinners = leaderboard.filter((e) => e.exactScores === maxExact);
    const exactPrize = calculatePrizeAmount(pot, pct.exact_score);
    const share = exactPrize / exactWinners.length;
    for (const w of exactWinners) addPrize(w.playerId, share);
  }

  const finalsWinners = finalsLeaderboard.filter((e) => e.rank === 1);
  if (finalsWinners.length > 0) {
    const finalsPrize = calculatePrizeAmount(pot, pct.finals_challenge);
    const share = finalsPrize / finalsWinners.length;
    for (const w of finalsWinners) addPrize(w.playerId, share);
  }

  if (settings.fun_prize_winner_id) {
    addPrize(
      settings.fun_prize_winner_id,
      calculatePrizeAmount(pot, pct.fun_prize)
    );
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
