-- Outcome bonus columns for matches (run on existing databases)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS home_win_bonus int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draw_bonus int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_win_bonus int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_advance_bonus int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_advance_bonus int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS odds_source text,
  ADD COLUMN IF NOT EXISTS odds_checked_at timestamptz;
