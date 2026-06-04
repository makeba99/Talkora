-- Analytics tables missing from migration 0000.
-- All statements use IF NOT EXISTS so this is safe to run against
-- databases where db:push already created these tables.

CREATE TABLE IF NOT EXISTS "page_views" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "path" varchar(255) NOT NULL,
  "referrer" text,
  "referrer_domain" varchar(120),
  "country" varchar(2),
  "session_hash" varchar(32),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_views_created_at_idx" ON "page_views" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_views_referrer_domain_idx" ON "page_views" ("referrer_domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_views_country_idx" ON "page_views" ("country");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "room_joins" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "room_id" text NOT NULL,
  "user_id" text NOT NULL,
  "country" varchar(2),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_joins_room_id_idx" ON "room_joins" ("room_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_joins_user_id_idx" ON "room_joins" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_joins_created_at_idx" ON "room_joins" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_joins_country_idx" ON "room_joins" ("country");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "recipient_type" varchar(20) NOT NULL,
  "recipient_count" integer NOT NULL DEFAULT 0,
  "open_count" integer NOT NULL DEFAULT 0,
  "click_count" integer NOT NULL DEFAULT 0,
  "admin_id" varchar(36) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_campaigns_admin_id_idx" ON "email_campaigns" ("admin_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_campaigns_created_at_idx" ON "email_campaigns" ("created_at");
