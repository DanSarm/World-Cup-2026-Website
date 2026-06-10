-- Unlock Tournament Picks so players can edit podium selections before kickoff.
-- Picks auto-lock when the first match starts (enforced in app + saveTournamentPodiumAction).
-- Safe: only updates the settings flag; no predictions are modified.

UPDATE settings
SET value = 'false'::jsonb
WHERE key = 'big_predictions_locked';

INSERT INTO settings (key, value)
SELECT 'big_predictions_locked', 'false'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM settings WHERE key = 'big_predictions_locked'
);
