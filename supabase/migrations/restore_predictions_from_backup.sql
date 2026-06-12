-- Run this AFTER exporting match_predictions from a Supabase backup
-- taken BEFORE 2026-06-12 20:30 UTC (when the bad 0-0 backfill ran).
--
-- 1. Supabase Dashboard → Database → Backups
-- 2. Restore to a temporary project / branch from before the backfill
-- 3. Export backup match_predictions to a staging table in production:
--
--    CREATE TEMP TABLE predictions_backup AS
--    SELECT * FROM dblink(...)  -- or CSV import via Table Editor
--
-- 4. Then run the UPDATE below (adjust table name if needed).

-- Example merge when predictions_backup holds the good rows:
/*
UPDATE match_predictions AS mp
SET
  pred_home_score = b.pred_home_score,
  pred_away_score = b.pred_away_score,
  pred_winner_team_id = b.pred_winner_team_id,
  pick_confirmed = COALESCE(b.pick_confirmed, true),
  updated_at = NOW()
FROM predictions_backup AS b
WHERE mp.player_id = b.player_id
  AND mp.match_id = b.match_id
  AND (
    mp.updated_at >= '2026-06-12T20:30:00Z'
    OR (
      mp.pred_home_score = 0
      AND mp.pred_away_score = 0
      AND (b.pred_home_score <> 0 OR b.pred_away_score <> 0)
    )
  );
*/

-- Undo ONLY the bad backfill batch (sets damaged 0-0 rows to unconfirmed so
-- they no longer score — does NOT restore original scores):
UPDATE match_predictions
SET pick_confirmed = false
WHERE pred_home_score = 0
  AND pred_away_score = 0
  AND pred_winner_team_id IS NULL
  AND pick_confirmed = true
  AND updated_at >= '2026-06-12T20:30:00Z';
