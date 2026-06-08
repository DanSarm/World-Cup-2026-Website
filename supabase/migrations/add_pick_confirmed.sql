-- Track whether the player explicitly locked/saved a pick.
-- Safe for existing data: no rows are deleted.

ALTER TABLE match_predictions
ADD COLUMN IF NOT EXISTS pick_confirmed boolean NOT NULL DEFAULT true;

ALTER TABLE match_predictions
ALTER COLUMN pick_confirmed SET DEFAULT false;

-- Auto-saved 0-0 placeholders were never intentionally locked — mark unconfirmed.
-- Real picks (non-zero scores, advance picks, or later explicit locks) stay confirmed.
UPDATE match_predictions
SET pick_confirmed = false
WHERE pred_home_score = 0
  AND pred_away_score = 0
  AND pred_winner_team_id IS NULL;
