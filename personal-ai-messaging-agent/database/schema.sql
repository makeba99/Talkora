CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_connections (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  display_name TEXT,
  external_user_id TEXT,
  last_error TEXT,
  paused INTEGER NOT NULL DEFAULT 0,
  auto_enabled INTEGER NOT NULL DEFAULT 0,
  connected_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_sessions (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,
  encrypted_payload TEXT NOT NULL,
  expires_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'personal',
  last_message_at TEXT,
  unread INTEGER NOT NULL DEFAULT 0,
  auto_enabled INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  UNIQUE(platform, external_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT,
  body TEXT NOT NULL,
  language TEXT,
  sent_at TEXT NOT NULL,
  normalized_json TEXT,
  UNIQUE(platform, external_id)
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  source_message_id TEXT,
  body TEXT NOT NULL,
  language TEXT,
  confidence REAL,
  reason TEXT,
  recommended_action TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  mode TEXT NOT NULL DEFAULT 'approval',
  simulation_enabled INTEGER NOT NULL DEFAULT 1,
  live_send_enabled INTEGER NOT NULL DEFAULT 0,
  emergency_stop INTEGER NOT NULL DEFAULT 0,
  poll_interval_sec INTEGER NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_settings (
  platform TEXT PRIMARY KEY,
  auto_enabled INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0,
  max_replies_per_hour INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_settings (
  conversation_id TEXT PRIMARY KEY,
  auto_enabled INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'personal',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS style_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  examples TEXT NOT NULL,
  notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_memory (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  platform TEXT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  event TEXT NOT NULL,
  platform TEXT,
  conversation_id TEXT,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sent_messages (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  draft_id TEXT,
  body TEXT NOT NULL,
  mode TEXT NOT NULL,
  simulated INTEGER NOT NULL DEFAULT 1,
  external_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
