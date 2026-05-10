-- Fix room_joins.user_id: varchar(36) is too small for Replit OIDC sub claims
-- and other user ID formats. Use TEXT so any user ID length is accepted.
ALTER TABLE room_joins ALTER COLUMN user_id TYPE text;

-- Also fix room_id to text for safety (room IDs are UUIDs = 36 chars, but be safe)
ALTER TABLE room_joins ALTER COLUMN room_id TYPE text;

-- Fix page_views.session_hash: currently varchar(32), fine as-is but make text
-- for consistency with no-limit policy on hashed values.
-- (no change needed — 32-char SHA256 slice always fits in varchar(32))
