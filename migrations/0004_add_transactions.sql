CREATE TABLE IF NOT EXISTS "transactions" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" varchar(36),
  "user_id" varchar(36) NOT NULL,
  "teacher_id" varchar(36),
  "amount" integer NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "platform_fee" integer NOT NULL DEFAULT 0,
  "teacher_amount" integer NOT NULL DEFAULT 0,
  "payment_method" varchar(20) NOT NULL,
  "payment_method_id" varchar(36),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "description" text,
  "idram_order_id" varchar(100),
  "confirmed_by_id" varchar(36),
  "confirmed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "transactions_teacher_id_idx" ON "transactions" ("teacher_id");
CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions" ("status");
CREATE INDEX IF NOT EXISTS "transactions_created_at_idx" ON "transactions" ("created_at");
