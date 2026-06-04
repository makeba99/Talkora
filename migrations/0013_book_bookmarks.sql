CREATE TABLE "book_bookmarks" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar(36) NOT NULL,
  "book_id" varchar(200) NOT NULL,
  "book_title" text NOT NULL,
  "book_author" text NOT NULL DEFAULT '',
  "page" integer NOT NULL,
  "total_pages" integer NOT NULL DEFAULT 0,
  "text_url" text NOT NULL DEFAULT '',
  "saved_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "bb_user_id_idx" ON "book_bookmarks" ("user_id");
CREATE UNIQUE INDEX "bb_unique_idx" ON "book_bookmarks" ("user_id", "book_id");
