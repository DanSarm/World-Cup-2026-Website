-- Backfill confirmed 0-0 picks only where no prediction row exists yet.
-- Never overwrites an existing row. Safe to re-run.

INSERT INTO match_predictions (
  player_id,
  match_id,
  pred_home_score,
  pred_away_score,
  pred_winner_team_id,
  pick_confirmed,
  updated_at
)
SELECT
  p.id,
  m.id,
  0,
  0,
  NULL,
  true,
  NOW()
FROM players p
CROSS JOIN matches m
WHERE m.home_team_id IS NOT NULL
  AND m.away_team_id IS NOT NULL
  AND (
    m.status IN ('final', 'live', 'locked')
    OR (m.kickoff_at IS NOT NULL AND m.kickoff_at <= NOW())
  )
  AND NOT EXISTS (
    SELECT 1
    FROM match_predictions mp
    WHERE mp.player_id = p.id
      AND mp.match_id = m.id
  )
ON CONFLICT (player_id, match_id) DO NOTHING;
