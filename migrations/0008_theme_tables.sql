-- Creates theme-related tables that exist in the schema but were never migrated.
-- All statements use IF NOT EXISTS so this is fully idempotent.

-- ── theme_visibility ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "theme_visibility" (
  "theme_id" varchar(50) PRIMARY KEY,
  "visible" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- ── user_theme_assignments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_theme_assignments" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(36) NOT NULL,
  "theme_id" varchar(50) NOT NULL,
  "assigned_by" varchar(36) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uta_user_theme_idx" ON "user_theme_assignments" ("user_id", "theme_id");
--> statement-breakpoint

-- ── theme_orders ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "theme_orders" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(36) NOT NULL,
  "theme_name" varchar(100) NOT NULL,
  "description" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "admin_note" text,
  "reviewed_by" varchar(36),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "reviewed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "theme_orders_user_id_idx" ON "theme_orders" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "theme_orders_status_idx" ON "theme_orders" ("status");
--> statement-breakpoint

-- ── user_theme_preferences ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_theme_preferences" (
  "user_id" varchar(36) PRIMARY KEY,
  "ordered_theme_ids" text NOT NULL DEFAULT '[]',
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
