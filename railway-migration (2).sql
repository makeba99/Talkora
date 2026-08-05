-- Vextorn Railway Migration Script
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).
-- Run this against your Railway PostgreSQL database to sync the schema.

-- ─── sessions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);

-- ─── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  display_name VARCHAR,
  profile_image_url VARCHAR,
  bio TEXT,
  avatar_ring VARCHAR,
  flair_badge VARCHAR,
  profile_decoration VARCHAR,
  instagram_url VARCHAR,
  linkedin_url VARCHAR,
  facebook_url VARCHAR,
  socials_pinned BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'online',
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  warning_count INTEGER NOT NULL DEFAULT 0,
  restricted_until TIMESTAMP,
  restricted_reason TEXT,
  restricted_by_id VARCHAR,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_ring VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS flair_badge VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_decoration VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_url VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_url VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS socials_pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'online';
ALTER TABLE users ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_by_id VARCHAR;

-- ─── rooms ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id VARCHAR(16),
  access_key VARCHAR(32),
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  level TEXT NOT NULL,
  max_users INTEGER NOT NULL DEFAULT 8,
  owner_id VARCHAR(36) NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  active_users INTEGER NOT NULL DEFAULT 0,
  room_theme VARCHAR(50),
  hologram_video_url VARCHAR(500),
  welcome_message TEXT,
  welcome_media_urls TEXT[] NOT NULL DEFAULT '{}',
  welcome_media_types TEXT[] NOT NULL DEFAULT '{}',
  welcome_media_position VARCHAR(20) NOT NULL DEFAULT 'below',
  welcome_accent_color VARCHAR(30) NOT NULL DEFAULT '#8B5CF6',
  talk_permission VARCHAR(20) NOT NULL DEFAULT 'everyone',
  camera_permission VARCHAR(20) NOT NULL DEFAULT 'everyone',
  screen_permission VARCHAR(20) NOT NULL DEFAULT 'everyone',
  youtube_permission VARCHAR(20) NOT NULL DEFAULT 'everyone',
  chat_permission VARCHAR(20) NOT NULL DEFAULT 'everyone',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS short_id VARCHAR(16);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS access_key VARCHAR(32);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_theme VARCHAR(50);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS hologram_video_url VARCHAR(500);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS welcome_media_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS welcome_media_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS welcome_media_position VARCHAR(20) NOT NULL DEFAULT 'below';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS welcome_accent_color VARCHAR(30) NOT NULL DEFAULT '#8B5CF6';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS talk_permission VARCHAR(20) NOT NULL DEFAULT 'everyone';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS camera_permission VARCHAR(20) NOT NULL DEFAULT 'everyone';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS screen_permission VARCHAR(20) NOT NULL DEFAULT 'everyone';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS youtube_permission VARCHAR(20) NOT NULL DEFAULT 'everyone';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS chat_permission VARCHAR(20) NOT NULL DEFAULT 'everyone';

CREATE UNIQUE INDEX IF NOT EXISTS rooms_short_id_idx ON rooms (short_id);
CREATE INDEX IF NOT EXISTS rooms_owner_id_idx ON rooms (owner_id);
CREATE INDEX IF NOT EXISTS rooms_created_at_idx ON rooms (created_at);

-- ─── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id VARCHAR(36) NOT NULL,
  to_id VARCHAR(36) NOT NULL,
  text TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_from_id_idx ON messages (from_id);
CREATE INDEX IF NOT EXISTS messages_to_id_idx ON messages (to_id);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (from_id, to_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);

-- ─── follows ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id VARCHAR(36) NOT NULL,
  following_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_id_idx ON follows (following_id);

-- ─── room_messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_messages (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_messages_room_id_idx ON room_messages (room_id);
CREATE INDEX IF NOT EXISTS room_messages_created_at_idx ON room_messages (created_at);

-- ─── notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL,
  from_user_id VARCHAR(36) NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at);

-- ─── user_notes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id VARCHAR(36) NOT NULL,
  subject_id VARCHAR(36) NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_notes_author_subject_idx ON user_notes (author_id, subject_id);
CREATE INDEX IF NOT EXISTS user_notes_author_idx ON user_notes (author_id);

-- ─── blocks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id VARCHAR(36) NOT NULL,
  blocked_id VARCHAR(36) NOT NULL,
  block_type VARCHAR(20) NOT NULL DEFAULT 'ordinary',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS block_type VARCHAR(20) NOT NULL DEFAULT 'ordinary';
CREATE INDEX IF NOT EXISTS blocks_blocker_id_idx ON blocks (blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_id_idx ON blocks (blocked_id);

-- ─── reports ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id VARCHAR(36) NOT NULL,
  reported_id VARCHAR(36) NOT NULL,
  reporter_name VARCHAR(100),
  reported_name VARCHAR(100),
  category VARCHAR(100),
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_name VARCHAR(100);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_name VARCHAR(100);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS category VARCHAR(100);
CREATE INDEX IF NOT EXISTS reports_reported_id_idx ON reports (reported_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at);

-- ─── room_votes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_votes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_votes_room_id_idx ON room_votes (room_id);
CREATE INDEX IF NOT EXISTS room_votes_user_room_idx ON room_votes (user_id, room_id);

-- ─── teachers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url VARCHAR(500),
  languages TEXT[] NOT NULL DEFAULT '{}',
  levels TEXT[] NOT NULL DEFAULT '{}',
  specializations TEXT[] NOT NULL DEFAULT '{}',
  hourly_rate INTEGER NOT NULL DEFAULT 0,
  session_durations TEXT[] NOT NULL DEFAULT '{30,60}',
  rating INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  user_id VARCHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS session_durations TEXT[] NOT NULL DEFAULT '{30,60}';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS user_id VARCHAR(36);

-- ─── bookings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  session_type VARCHAR(20) NOT NULL DEFAULT 'private',
  notes TEXT,
  room_id VARCHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) NOT NULL DEFAULT 'private';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_id VARCHAR(36);
CREATE INDEX IF NOT EXISTS bookings_teacher_id_idx ON bookings (teacher_id);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings (user_id);

-- ─── teacher_reviews ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_reviews (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS teacher_reviews_teacher_id_idx ON teacher_reviews (teacher_id);
CREATE INDEX IF NOT EXISTS teacher_reviews_user_teacher_idx ON teacher_reviews (user_id, teacher_id);

-- ─── teacher_applications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_applications (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL,
  name TEXT NOT NULL,
  bio TEXT NOT NULL,
  languages TEXT[] NOT NULL DEFAULT '{}',
  levels TEXT[] NOT NULL DEFAULT '{}',
  specializations TEXT[] NOT NULL DEFAULT '{}',
  suggested_rate INTEGER NOT NULL DEFAULT 0,
  paypal_email VARCHAR(255) NOT NULL,
  experience TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  approved_rate INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE teacher_applications ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE teacher_applications ADD COLUMN IF NOT EXISTS approved_rate INTEGER;
CREATE INDEX IF NOT EXISTS teacher_applications_user_id_idx ON teacher_applications (user_id);
CREATE INDEX IF NOT EXISTS teacher_applications_status_idx ON teacher_applications (status);

-- ─── user_comments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_comments (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_comments_target_user_id_idx ON user_comments (target_user_id);
CREATE INDEX IF NOT EXISTS user_comments_author_id_idx ON user_comments (author_id);

-- ─── user_badges ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL,
  badge_type VARCHAR(50) NOT NULL,
  awarded_by_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_badges_user_id_idx ON user_badges (user_id);

-- ─── badge_applications ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_applications (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL,
  badge_type VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by_id VARCHAR(36),
  admin_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE badge_applications ADD COLUMN IF NOT EXISTS reviewed_by_id VARCHAR(36);
ALTER TABLE badge_applications ADD COLUMN IF NOT EXISTS admin_notes TEXT;
CREATE INDEX IF NOT EXISTS badge_applications_user_id_idx ON badge_applications (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS badge_applications_user_type_idx ON badge_applications (user_id, badge_type) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS badge_applications_status_idx ON badge_applications (status);

-- ─── announcements ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  body_after_media TEXT,
  media_position VARCHAR(20) NOT NULL DEFAULT 'below',
  kind VARCHAR(30) NOT NULL DEFAULT 'platform',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  media_types TEXT[] NOT NULL DEFAULT '{}',
  show_on_lobby BOOLEAN NOT NULL DEFAULT false,
  created_by_id VARCHAR(36) NOT NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS body_after_media TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media_position VARCHAR(20) NOT NULL DEFAULT 'below';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS kind VARCHAR(30) NOT NULL DEFAULT 'platform';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS show_on_lobby BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS announcements_status_idx ON announcements (status);
CREATE INDEX IF NOT EXISTS announcements_published_at_idx ON announcements (published_at);

-- ─── announcement_receipts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcement_receipts (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  viewed_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS announcement_receipts_announcement_user_idx ON announcement_receipts (announcement_id, user_id);

-- ─── security_events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_events (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36),
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  user_agent TEXT,
  request_path VARCHAR(255),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by_id VARCHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_user_id_idx ON security_events (user_id);
CREATE INDEX IF NOT EXISTS security_events_type_idx ON security_events (event_type);
CREATE INDEX IF NOT EXISTS security_events_severity_idx ON security_events (severity);
CREATE INDEX IF NOT EXISTS security_events_resolved_idx ON security_events (resolved);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events (created_at);

-- ─── payment_methods ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL,
  last4 VARCHAR(4) NOT NULL,
  brand VARCHAR(20) NOT NULL,
  exp_month INTEGER NOT NULL,
  exp_year INTEGER NOT NULL,
  cardholder_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_methods_user_id_idx ON payment_methods (user_id);

-- ─── app_settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
