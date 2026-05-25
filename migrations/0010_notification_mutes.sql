CREATE TABLE IF NOT EXISTS notification_mutes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id VARCHAR(36) NOT NULL,
  muted_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nm_muter_id_idx ON notification_mutes (muter_id);
CREATE INDEX IF NOT EXISTS nm_muted_id_idx ON notification_mutes (muted_id);
CREATE UNIQUE INDEX IF NOT EXISTS nm_unique_idx ON notification_mutes (muter_id, muted_id);
