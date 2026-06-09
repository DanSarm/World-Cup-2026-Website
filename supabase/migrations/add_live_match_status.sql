-- Live in-progress matches (scores update until final)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('scheduled', 'locked', 'live', 'final'));

ALTER TABLE matches ADD COLUMN IF NOT EXISTS live_updated_at timestamptz;
