CREATE TABLE IF NOT EXISTS "message_requests" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_id" varchar(36) NOT NULL,
  "to_id" varchar(36) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mr_from_id_idx" ON "message_requests" ("from_id");
CREATE INDEX IF NOT EXISTS "mr_to_id_idx" ON "message_requests" ("to_id");
CREATE UNIQUE INDEX IF NOT EXISTS "mr_unique_idx" ON "message_requests" ("from_id", "to_id");
