-- Odds sync: snapshots table + match odds metadata

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

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS odds_event_id text,
  ADD COLUMN IF NOT EXISTS odds_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS odds_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS odds_status text DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS home_implied_probability numeric(8,6),
  ADD COLUMN IF NOT EXISTS draw_implied_probability numeric(8,6),
  ADD COLUMN IF NOT EXISTS away_implied_probability numeric(8,6),
  ADD COLUMN IF NOT EXISTS home_advance_probability numeric(8,6),
  ADD COLUMN IF NOT EXISTS away_advance_probability numeric(8,6),
  ADD COLUMN IF NOT EXISTS odds_source_note text;

-- Migrate legacy columns if present
UPDATE matches SET odds_source_note = odds_source WHERE odds_source_note IS NULL AND odds_source IS NOT NULL;
UPDATE matches SET odds_last_synced_at = odds_checked_at WHERE odds_last_synced_at IS NULL AND odds_checked_at IS NOT NULL;
