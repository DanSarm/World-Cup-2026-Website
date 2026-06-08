-- Tournament podium picks: 1st, 2nd, 3rd place (replaces Big Picks UI).
CREATE TABLE IF NOT EXISTS tournament_podium_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  first_place_team_id uuid REFERENCES teams(id),
  second_place_team_id uuid REFERENCES teams(id),
  third_place_team_id uuid REFERENCES teams(id),
  points int DEFAULT 0,
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(player_id)
);
