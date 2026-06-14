-- Generic dedupe for all push notification types (free, event-driven)

CREATE TABLE IF NOT EXISTS notifications_sent (
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  notification_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, notification_key)
);

CREATE INDEX IF NOT EXISTS notifications_sent_key_idx
  ON notifications_sent (notification_key);
