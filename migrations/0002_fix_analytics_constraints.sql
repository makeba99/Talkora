-- Fix room_joins column types — but only if the table already exists.
-- On a fresh database room_joins is created later in 0003, so we use a
-- DO block to skip silently when the table isn't there yet.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'room_joins'
  ) THEN
    ALTER TABLE room_joins ALTER COLUMN user_id TYPE text;
    ALTER TABLE room_joins ALTER COLUMN room_id TYPE text;
  END IF;
END $$;
