-- Family Cup 2026 Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text NOT NULL,
  fifa_code text UNIQUE NOT NULL,
  flag_emoji text NOT NULL,
  group_letter text,
  created_at timestamptz DEFAULT now()
);

-- Players
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text UNIQUE NOT NULL,
  pin_hash text NOT NULL,
  favorite_team_id uuid REFERENCES teams(id),
  avatar_emoji text DEFAULT '⚽',
  is_admin boolean DEFAULT false,
  paid boolean DEFAULT false,
  paid_amount numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_login_at timestamptz
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number int UNIQUE NOT NULL,
  stage text NOT NULL CHECK (stage IN ('group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final')),
  group_letter text,
  kickoff_at timestamptz,
  venue text,
  city text,
  home_team_id uuid REFERENCES teams(id),
  away_team_id uuid REFERENCES teams(id),
  home_label text NOT NULL,
  away_label text NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'locked', 'live', 'final')),
  home_score int,
  away_score int,
  winner_team_id uuid REFERENCES teams(id),
  live_updated_at timestamptz,
  decided_by_penalties boolean DEFAULT false,
  home_win_bonus int NOT NULL DEFAULT 0,
  draw_bonus int NOT NULL DEFAULT 0,
  away_win_bonus int NOT NULL DEFAULT 0,
  home_advance_bonus int NOT NULL DEFAULT 0,
  away_advance_bonus int NOT NULL DEFAULT 0,
  odds_event_id text,
  odds_last_synced_at timestamptz,
  odds_locked_at timestamptz,
  odds_status text DEFAULT 'not_synced' CHECK (odds_status IN ('not_synced', 'synced', 'locked', 'failed', 'manual')),
  home_implied_probability numeric(8,6),
  draw_implied_probability numeric(8,6),
  away_implied_probability numeric(8,6),
  home_advance_probability numeric(8,6),
  away_advance_probability numeric(8,6),
  odds_source_note text,
  odds_source text,
  odds_checked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Odds snapshots (admin-only raw odds; users never see this table)
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

-- Match Predictions
CREATE TABLE IF NOT EXISTS match_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  pred_home_score int NOT NULL,
  pred_away_score int NOT NULL,
  pred_winner_team_id uuid REFERENCES teams(id),
  pick_confirmed boolean NOT NULL DEFAULT false,
  points int DEFAULT 0,
  exact_score boolean DEFAULT false,
  correct_result boolean DEFAULT false,
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(player_id, match_id)
);

-- Tournament Podium Predictions
CREATE TABLE IF NOT EXISTS tournament_podium_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  first_place_team_id uuid REFERENCES teams(id),
  second_place_team_id uuid REFERENCES teams(id),
  third_place_team_id uuid REFERENCES teams(id),
  podium_confirmed boolean NOT NULL DEFAULT false,
  points int DEFAULT 0,
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(player_id)
);

-- Big Predictions (legacy — kept for existing data)
CREATE TABLE IF NOT EXISTS big_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  group_winners jsonb NOT NULL DEFAULT '{}',
  group_runners_up jsonb NOT NULL DEFAULT '{}',
  semifinalists uuid[] DEFAULT '{}',
  finalists uuid[] DEFAULT '{}',
  champion_team_id uuid REFERENCES teams(id),
  top_scorer text,
  points int DEFAULT 0,
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(player_id)
);

-- Finals Challenge Predictions
CREATE TABLE IF NOT EXISTS finals_challenge_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  quarterfinalists uuid[] DEFAULT '{}',
  semifinalists uuid[] DEFAULT '{}',
  finalists uuid[] DEFAULT '{}',
  champion_team_id uuid REFERENCES teams(id),
  points int DEFAULT 0,
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(player_id)
);

-- Actual Tournament Results
CREATE TABLE IF NOT EXISTS actual_tournament_results (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- Manual Adjustments
CREATE TABLE IF NOT EXISTS manual_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id),
  points int NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES players(id),
  created_at timestamptz DEFAULT now()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_player_id uuid REFERENCES players(id),
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_at);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_match ON odds_snapshots(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_stage ON matches(stage);
CREATE INDEX IF NOT EXISTS idx_predictions_player ON match_predictions(player_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match ON match_predictions(match_id);

-- Seed Settings
INSERT INTO settings (key, value) VALUES
  ('buy_in', '50'),
  ('pool_locked', 'false'),
  ('big_predictions_locked', 'false'),
  ('finals_challenge_open', 'false'),
  ('tournament_complete', 'false'),
  ('payout_percentages', '{"overall_first": 55, "overall_second": 25, "overall_third": 15, "exact_score": 0, "finals_challenge": 0, "fun_prize": 0}'),
  ('exact_score_fire_bonus_enabled', 'true'),
  ('group_stage_match_point_cap', '18'),
  ('perfect_day_bonus_enabled', 'true'),
  ('perfect_day_bonus_points', '5'),
  ('odds_lock_hours_before_kickoff', '1')
ON CONFLICT (key) DO NOTHING;

-- Seed Teams (48 World Cup 2026 teams)
INSERT INTO teams (name, short_name, fifa_code, flag_emoji, group_letter) VALUES
  ('Mexico', 'Mexico', 'MEX', '🇲🇽', 'A'),
  ('South Africa', 'S. Africa', 'RSA', '🇿🇦', 'A'),
  ('Korea Republic', 'Korea', 'KOR', '🇰🇷', 'A'),
  ('Czechia', 'Czechia', 'CZE', '🇨🇿', 'A'),
  ('Canada', 'Canada', 'CAN', '🇨🇦', 'B'),
  ('Bosnia and Herzegovina', 'Bosnia', 'BIH', '🇧🇦', 'B'),
  ('Qatar', 'Qatar', 'QAT', '🇶🇦', 'B'),
  ('Switzerland', 'Switzerland', 'SUI', '🇨🇭', 'B'),
  ('Brazil', 'Brazil', 'BRA', '🇧🇷', 'C'),
  ('Morocco', 'Morocco', 'MAR', '🇲🇦', 'C'),
  ('Haiti', 'Haiti', 'HAI', '🇭🇹', 'C'),
  ('Scotland', 'Scotland', 'SCO', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'C'),
  ('USA', 'USA', 'USA', '🇺🇸', 'D'),
  ('Paraguay', 'Paraguay', 'PAR', '🇵🇾', 'D'),
  ('Australia', 'Australia', 'AUS', '🇦🇺', 'D'),
  ('Türkiye', 'Türkiye', 'TUR', '🇹🇷', 'D'),
  ('Germany', 'Germany', 'GER', '🇩🇪', 'E'),
  ('Curaçao', 'Curaçao', 'CUW', '🇨🇼', 'E'),
  ('Côte d''Ivoire', 'Ivory Coast', 'CIV', '🇨🇮', 'E'),
  ('Ecuador', 'Ecuador', 'ECU', '🇪🇨', 'E'),
  ('Netherlands', 'Netherlands', 'NED', '🇳🇱', 'F'),
  ('Japan', 'Japan', 'JPN', '🇯🇵', 'F'),
  ('Sweden', 'Sweden', 'SWE', '🇸🇪', 'F'),
  ('Tunisia', 'Tunisia', 'TUN', '🇹🇳', 'F'),
  ('Belgium', 'Belgium', 'BEL', '🇧🇪', 'G'),
  ('Egypt', 'Egypt', 'EGY', '🇪🇬', 'G'),
  ('IR Iran', 'Iran', 'IRN', '🇮🇷', 'G'),
  ('New Zealand', 'New Zealand', 'NZL', '🇳🇿', 'G'),
  ('Spain', 'Spain', 'ESP', '🇪🇸', 'H'),
  ('Cabo Verde', 'Cabo Verde', 'CPV', '🇨🇻', 'H'),
  ('Saudi Arabia', 'Saudi Arabia', 'KSA', '🇸🇦', 'H'),
  ('Uruguay', 'Uruguay', 'URU', '🇺🇾', 'H'),
  ('France', 'France', 'FRA', '🇫🇷', 'I'),
  ('Senegal', 'Senegal', 'SEN', '🇸🇳', 'I'),
  ('Iraq', 'Iraq', 'IRQ', '🇮🇶', 'I'),
  ('Norway', 'Norway', 'NOR', '🇳🇴', 'I'),
  ('Argentina', 'Argentina', 'ARG', '🇦🇷', 'J'),
  ('Algeria', 'Algeria', 'ALG', '🇩🇿', 'J'),
  ('Austria', 'Austria', 'AUT', '🇦🇹', 'J'),
  ('Jordan', 'Jordan', 'JOR', '🇯🇴', 'J'),
  ('Portugal', 'Portugal', 'POR', '🇵🇹', 'K'),
  ('Congo DR', 'Congo DR', 'COD', '🇨🇩', 'K'),
  ('Uzbekistan', 'Uzbekistan', 'UZB', '🇺🇿', 'K'),
  ('Colombia', 'Colombia', 'COL', '🇨🇴', 'K'),
  ('England', 'England', 'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'L'),
  ('Croatia', 'Croatia', 'CRO', '🇭🇷', 'L'),
  ('Ghana', 'Ghana', 'GHA', '🇬🇭', 'L'),
  ('Panama', 'Panama', 'PAN', '🇵🇦', 'L')
ON CONFLICT (fifa_code) DO NOTHING;
