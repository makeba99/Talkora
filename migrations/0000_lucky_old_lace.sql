CREATE TABLE "announcement_receipts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"viewed_at" timestamp,
	"dismissed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"body_after_media" text,
	"media_position" varchar(20) DEFAULT 'below' NOT NULL,
	"kind" varchar(30) DEFAULT 'platform' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"media_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"media_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"show_on_lobby" boolean DEFAULT false NOT NULL,
	"created_by_id" varchar(36) NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badge_applications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"badge_type" varchar(50) NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" varchar(36),
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" varchar(36) NOT NULL,
	"blocked_id" varchar(36) NOT NULL,
	"block_type" varchar(20) DEFAULT 'ordinary' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"session_type" varchar(20) DEFAULT 'private' NOT NULL,
	"notes" text,
	"room_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" varchar(36) NOT NULL,
	"following_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_id" varchar(36) NOT NULL,
	"to_id" varchar(36) NOT NULL,
	"text" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"from_user_id" varchar(36) NOT NULL,
	"type" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"last4" varchar(4) NOT NULL,
	"brand" varchar(20) NOT NULL,
	"exp_month" integer NOT NULL,
	"exp_year" integer NOT NULL,
	"cardholder_name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" varchar(36) NOT NULL,
	"reported_id" varchar(36) NOT NULL,
	"reporter_name" varchar(100),
	"reported_name" varchar(100),
	"category" varchar(100),
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_messages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_votes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_id" varchar(16),
	"access_key" varchar(32),
	"title" text NOT NULL,
	"language" text NOT NULL,
	"level" text NOT NULL,
	"max_users" integer DEFAULT 8 NOT NULL,
	"owner_id" varchar(36) NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"room_theme" varchar(50),
	"hologram_video_url" varchar(500),
	"welcome_message" text,
	"welcome_media_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"welcome_media_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"welcome_media_position" varchar(20) DEFAULT 'below' NOT NULL,
	"welcome_accent_color" varchar(30) DEFAULT '#8B5CF6' NOT NULL,
	"talk_permission" varchar(20) DEFAULT 'everyone' NOT NULL,
	"camera_permission" varchar(20) DEFAULT 'everyone' NOT NULL,
	"screen_permission" varchar(20) DEFAULT 'everyone' NOT NULL,
	"youtube_permission" varchar(20) DEFAULT 'everyone' NOT NULL,
	"chat_permission" varchar(20) DEFAULT 'everyone' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36),
	"event_type" varchar(50) NOT NULL,
	"severity" varchar(20) DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"user_agent" text,
	"request_path" varchar(255),
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_applications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"bio" text NOT NULL,
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"specializations" text[] DEFAULT '{}'::text[] NOT NULL,
	"suggested_rate" integer DEFAULT 0 NOT NULL,
	"paypal_email" varchar(255) NOT NULL,
	"experience" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"approved_rate" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_reviews" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"avatar_url" varchar(500),
	"languages" text[] DEFAULT '{}'::text[] NOT NULL,
	"levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"specializations" text[] DEFAULT '{}'::text[] NOT NULL,
	"hourly_rate" integer DEFAULT 0 NOT NULL,
	"session_durations" text[] DEFAULT '{30,60}'::text[] NOT NULL,
	"rating" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"badge_type" varchar(50) NOT NULL,
	"awarded_by_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_comments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_user_id" varchar(36) NOT NULL,
	"author_id" varchar(36) NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" varchar(36) NOT NULL,
	"subject_id" varchar(36) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"display_name" varchar,
	"profile_image_url" varchar,
	"bio" text,
	"avatar_ring" varchar,
	"flair_badge" varchar,
	"profile_decoration" varchar,
	"instagram_url" varchar,
	"linkedin_url" varchar,
	"facebook_url" varchar,
	"socials_pinned" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'online' NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"restricted_until" timestamp,
	"restricted_reason" text,
	"restricted_by_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "announcement_receipts_announcement_user_idx" ON "announcement_receipts" USING btree ("announcement_id","user_id");--> statement-breakpoint
CREATE INDEX "announcements_status_idx" ON "announcements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "announcements_published_at_idx" ON "announcements" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "badge_applications_user_id_idx" ON "badge_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "badge_applications_user_type_idx" ON "badge_applications" USING btree ("user_id","badge_type");--> statement-breakpoint
CREATE INDEX "badge_applications_status_idx" ON "badge_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blocks_blocker_id_idx" ON "blocks" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_id_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "bookings_teacher_id_idx" ON "bookings" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "bookings_user_id_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "follows_follower_id_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_id_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "messages_from_id_idx" ON "messages" USING btree ("from_id");--> statement-breakpoint
CREATE INDEX "messages_to_id_idx" ON "messages" USING btree ("to_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("from_id","to_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_methods_user_id_idx" ON "payment_methods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_reported_id_idx" ON "reports" USING btree ("reported_id");--> statement-breakpoint
CREATE INDEX "reports_created_at_idx" ON "reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "room_messages_room_id_idx" ON "room_messages" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_messages_created_at_idx" ON "room_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "room_votes_room_id_idx" ON "room_votes" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_votes_user_room_idx" ON "room_votes" USING btree ("user_id","room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_short_id_idx" ON "rooms" USING btree ("short_id");--> statement-breakpoint
CREATE INDEX "rooms_owner_id_idx" ON "rooms" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "rooms_created_at_idx" ON "rooms" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_events_user_id_idx" ON "security_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_events_type_idx" ON "security_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "security_events_severity_idx" ON "security_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "security_events_resolved_idx" ON "security_events" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "security_events_created_at_idx" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "teacher_applications_user_id_idx" ON "teacher_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "teacher_applications_status_idx" ON "teacher_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "teacher_reviews_teacher_id_idx" ON "teacher_reviews" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "teacher_reviews_user_teacher_idx" ON "teacher_reviews" USING btree ("user_id","teacher_id");--> statement-breakpoint
CREATE INDEX "user_badges_user_id_idx" ON "user_badges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_comments_target_user_id_idx" ON "user_comments" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "user_comments_author_id_idx" ON "user_comments" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_notes_author_subject_idx" ON "user_notes" USING btree ("author_id","subject_id");--> statement-breakpoint
CREATE INDEX "user_notes_author_idx" ON "user_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");