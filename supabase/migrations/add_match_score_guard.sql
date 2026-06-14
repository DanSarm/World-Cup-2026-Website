-- Prevent accidental wipe of played match results (June 2026 incident).
-- Run: npm run migrate:match-score-guard
-- Or paste into Supabase SQL Editor.

CREATE OR REPLACE FUNCTION guard_match_scores_update()
RETURNS TRIGGER AS $$
DECLARE
  pick_count int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Never downgrade a finalized result back to scheduled.
    IF OLD.status = 'final'
       AND NEW.status = 'scheduled'
       AND OLD.home_score IS NOT NULL
       AND OLD.away_score IS NOT NULL
    THEN
      RAISE EXCEPTION
        'match_score_guard: cannot revert final match % to scheduled',
        OLD.match_number;
    END IF;

    -- Never clear scores once players have confirmed picks on this match.
    IF OLD.home_score IS NOT NULL
       AND OLD.away_score IS NOT NULL
       AND (NEW.home_score IS NULL OR NEW.away_score IS NULL)
    THEN
      SELECT COUNT(*) INTO pick_count
      FROM match_predictions
      WHERE match_id = OLD.id
        AND pick_confirmed IS TRUE;

      IF pick_count > 0 THEN
        RAISE EXCEPTION
          'match_score_guard: cannot clear scores on match % (% confirmed picks)',
          OLD.match_number, pick_count;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_match_scores ON matches;

CREATE TRIGGER trg_guard_match_scores
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION guard_match_scores_update();

-- Point-in-time match result snapshots (npm run backup:tournament).

CREATE TABLE IF NOT EXISTS match_result_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  rows jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_result_snapshots_created
  ON match_result_snapshots (created_at DESC);
