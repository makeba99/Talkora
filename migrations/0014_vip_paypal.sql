ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vip_tier" varchar(20);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vip_since" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "paypal_payments" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(36) NOT NULL,
  "txn_id" varchar(64) NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" varchar(8) NOT NULL DEFAULT 'USD',
  "vip_tier" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'completed',
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "paypal_payments_txn_id_idx" ON "paypal_payments" ("txn_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "paypal_payments_user_id_idx" ON "paypal_payments" ("user_id");
