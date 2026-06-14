-- Web Push subscriptions + pick reminder dedupe (free browser/phone notifications)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_player_id_idx
  ON push_subscriptions (player_id);

CREATE TABLE IF NOT EXISTS pick_reminder_sent (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, match_id)
);

CREATE INDEX IF NOT EXISTS pick_reminder_sent_match_id_idx
  ON pick_reminder_sent (match_id);
