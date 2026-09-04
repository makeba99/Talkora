ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "lobby_profile_style" varchar(20) NOT NULL DEFAULT 'circle';
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "lobby_profile_size" varchar(10) NOT NULL DEFAULT 'md';
