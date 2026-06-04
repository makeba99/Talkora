-- Safe backfill migration: adds any columns that may be missing from existing
-- production tables. Every statement uses ADD COLUMN IF NOT EXISTS so this is
-- fully idempotent — running it against a schema that already has these columns
-- is a no-op.
--
-- Root cause: the initial migration (0000) uses CREATE TABLE. When the
-- migration runner patches it to CREATE TABLE IF NOT EXISTS, an existing table
-- causes the whole statement to be skipped — including any columns added after
-- that table was first created in production.

-- ── rooms ─────────────────────────────────────────────────────────────────────
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "short_id" varchar(16);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "access_key" varchar(32);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "hologram_video_url" varchar(500);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "welcome_message" text;
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "welcome_media_urls" text[] NOT NULL DEFAULT '{}'::text[];
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "welcome_media_types" text[] NOT NULL DEFAULT '{}'::text[];
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "welcome_media_position" varchar(20) NOT NULL DEFAULT 'below';
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "welcome_accent_color" varchar(30) NOT NULL DEFAULT '#8B5CF6';
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "talk_permission" varchar(20) NOT NULL DEFAULT 'everyone';
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "camera_permission" varchar(20) NOT NULL DEFAULT 'everyone';
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "screen_permission" varchar(20) NOT NULL DEFAULT 'everyone';
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "youtube_permission" varchar(20) NOT NULL DEFAULT 'everyone';
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "chat_permission" varchar(20) NOT NULL DEFAULT 'everyone';
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "room_theme" varchar(50);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "is_public" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "active_users" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- ── users ─────────────────────────────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" varchar;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_ring" varchar;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "flair_badge" varchar;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_decoration" varchar;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "instagram_url" varchar;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_url" varchar;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "facebook_url" varchar;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "socials_pinned" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar(20) NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "warning_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "restricted_until" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "restricted_reason" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "restricted_by_id" varchar;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
--> statement-breakpoint

-- ── blocks ────────────────────────────────────────────────────────────────────
ALTER TABLE "blocks" ADD COLUMN IF NOT EXISTS "block_type" varchar(20) NOT NULL DEFAULT 'ordinary';
--> statement-breakpoint

-- ── reports ───────────────────────────────────────────────────────────────────
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reporter_name" varchar(100);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reported_name" varchar(100);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "category" varchar(100);
--> statement-breakpoint

-- ── announcements ─────────────────────────────────────────────────────────────
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "body_after_media" text;
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "media_position" varchar(20) NOT NULL DEFAULT 'below';
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "kind" varchar(30) NOT NULL DEFAULT 'platform';
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "show_on_lobby" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "media_urls" text[] NOT NULL DEFAULT '{}'::text[];
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "media_types" text[] NOT NULL DEFAULT '{}'::text[];
--> statement-breakpoint

-- ── security_events ───────────────────────────────────────────────────────────
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "resolved" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "resolved_by_id" varchar(36);
--> statement-breakpoint

-- ── bookings ──────────────────────────────────────────────────────────────────
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "session_type" varchar(20) NOT NULL DEFAULT 'private';
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "room_id" varchar(36);
--> statement-breakpoint

-- ── teachers ──────────────────────────────────────────────────────────────────
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "session_durations" text[] NOT NULL DEFAULT '{30,60}'::text[];
--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "user_id" varchar(36);
--> statement-breakpoint

-- ── safe index creation (rooms short_id unique index) ─────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "rooms_short_id_idx" ON "rooms" ("short_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rooms_owner_id_idx" ON "rooms" ("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rooms_created_at_idx" ON "rooms" ("created_at");
