/** Row shape sufficient for wipe detection. */
export type PredictionWriteRow = {
  pred_home_score: number;
  pred_away_score: number;
  pick_confirmed?: boolean | null;
};

/**
 * Returns true when a write would replace a confirmed non–0-0 pick with 0-0.
 * This was the failure mode of the June 2026 backfill bug.
 */
export function wouldWipeConfirmedPick(
  existing: PredictionWriteRow | null | undefined,
  next: Pick<PredictionWriteRow, "pred_home_score" | "pred_away_score">
): boolean {
  if (!existing?.pick_confirmed) return false;
  const hadRealScore =
    existing.pred_home_score !== 0 || existing.pred_away_score !== 0;
  const becomingZeroZero =
    next.pred_home_score === 0 && next.pred_away_score === 0;
  return hadRealScore && becomingZeroZero;
}

export function assertSafePredictionWrite(
  existing: PredictionWriteRow | null | undefined,
  next: Pick<PredictionWriteRow, "pred_home_score" | "pred_away_score">,
  context: string
): void {
  if (wouldWipeConfirmedPick(existing, next)) {
    throw new Error(
      `${context}: refused to overwrite confirmed pick ${existing!.pred_home_score}-${existing!.pred_away_score} with 0-0`
    );
  }
}
