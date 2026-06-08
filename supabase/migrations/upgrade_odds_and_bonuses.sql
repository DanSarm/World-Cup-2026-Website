-- Safe upgrade for existing Family Cup databases.
-- Copy ALL of this into Supabase SQL Editor and click Run.
-- (Do not paste the filename — paste this SQL only.)

-- 1) Outcome bonus columns
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_win_bonus int NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS draw_bonus int NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_win_bonus int NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_advance_bonus int NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_advance_bonus int NOT NULL DEFAULT 0;

-- 2) Odds sync columns
ALTER TABLE matches ADD COLUMN IF NOT EXISTS odds_event_id text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS odds_last_synced_at timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS odds_locked_at timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS odds_status text DEFAULT 'not_synced';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_implied_probability numeric(8,6);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS draw_implied_probability numeric(8,6);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_implied_probability numeric(8,6);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_advance_probability numeric(8,6);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_advance_probability numeric(8,6);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS odds_source_note text;

-- Optional legacy columns (ignore errors if you re-run)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS odds_source text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS odds_checked_at timestamptz;

-- 3) Odds snapshots (admin-only raw prices)
CREATE TABLE IF NOT EXISTS odds_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source_event_id text,
  bookmaker_key text,
  bookmaker_title text,
  market_key text NOT NULL,
  outcome_name text NOT NULL,
  outcome_type text NOT NULL CHECK (outcome_type IN ('home', 'draw', 'away', 'home_advance', 'away_advance')),
  decimal_price numeric(10,4),
  american_price int,
  raw_implied_probability numeric(8,6),
  normalized_probability numeric(8,6),
  fetched_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odds_snapshots_match ON odds_snapshots(match_id);

-- 4) Verify (should return one row with home_win_bonus column)
SELECT match_number, home_win_bonus, odds_status FROM matches LIMIT 1;
