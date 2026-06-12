-- Point-in-time backups of match_predictions (run backup via npm run backup:predictions).

CREATE TABLE IF NOT EXISTS prediction_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  rows jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_snapshots_created
  ON prediction_snapshots (created_at DESC);

-- Block silent 0-0 overwrites of confirmed real picks (June 2026 backfill bug).
CREATE OR REPLACE FUNCTION guard_match_predictions_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.pick_confirmed IS TRUE
     AND (OLD.pred_home_score <> 0 OR OLD.pred_away_score <> 0)
     AND NEW.pred_home_score = 0
     AND NEW.pred_away_score = 0
     AND NEW.pred_winner_team_id IS NULL
  THEN
    RAISE EXCEPTION
      'prediction_guard: cannot overwrite confirmed pick %-% with 0-0',
      OLD.pred_home_score, OLD.pred_away_score;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_match_predictions ON match_predictions;

CREATE TRIGGER trg_guard_match_predictions
  BEFORE UPDATE ON match_predictions
  FOR EACH ROW
  EXECUTE FUNCTION guard_match_predictions_update();
