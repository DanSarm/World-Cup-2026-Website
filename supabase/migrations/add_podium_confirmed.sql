-- Once confirmed, podium picks cannot be changed.
ALTER TABLE tournament_podium_predictions
ADD COLUMN IF NOT EXISTS podium_confirmed boolean NOT NULL DEFAULT false;

UPDATE tournament_podium_predictions
SET podium_confirmed = true
WHERE first_place_team_id IS NOT NULL
  AND second_place_team_id IS NOT NULL
  AND third_place_team_id IS NOT NULL;
