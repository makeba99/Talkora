ALTER TABLE "rooms" ALTER COLUMN "lobby_profile_style" SET DEFAULT 'tile';
UPDATE "rooms" SET "lobby_profile_style" = 'tile' WHERE "lobby_profile_style" = 'circle';
