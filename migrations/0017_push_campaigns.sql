-- Enhance push subscriptions for multi-device lifecycle + inactive tracking
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS push_subscriptions_active_idx ON push_subscriptions (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS push_subscriptions_user_active_idx ON push_subscriptions (user_id, is_active);

-- Last activity for re-engagement targeting
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE INDEX IF NOT EXISTS users_last_seen_at_idx ON users (last_seen_at);

-- Push campaign audit / delivery history
CREATE TABLE IF NOT EXISTS push_campaigns (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_id varchar(36) NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  destination_url text NOT NULL DEFAULT '/',
  image_url text,
  audience varchar(40) NOT NULL,
  inactive_days integer,
  target_users integer NOT NULL DEFAULT 0,
  target_devices integer NOT NULL DEFAULT 0,
  attempted integer NOT NULL DEFAULT 0,
  accepted integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  invalid_removed integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_campaigns_created_at_idx ON push_campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS push_campaigns_admin_id_idx ON push_campaigns (admin_id);
