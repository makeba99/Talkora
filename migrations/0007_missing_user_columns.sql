-- Safe backfill migration: adds columns present in the schema but missing
-- from the production database. Every statement uses ADD COLUMN IF NOT EXISTS
-- so this is fully idempotent.

-- ── users: profile_animation ──────────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_animation" varchar;
--> statement-breakpoint

-- ── users: status ─────────────────────────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'online';
--> statement-breakpoint
