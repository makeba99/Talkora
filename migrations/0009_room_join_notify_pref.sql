-- Add room-join notification preference to users.
-- Values: 'everyone' (default), 'mutual', 'none'
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "room_join_notify_from" varchar(20) NOT NULL DEFAULT 'everyone';
