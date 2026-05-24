ALTER TABLE page_views ADD COLUMN IF NOT EXISTS user_id text;
--> statement-breakpoint
ALTER TABLE room_joins ADD COLUMN IF NOT EXISTS room_name varchar(120);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS page_views_user_id_idx ON page_views (user_id);
