import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Database } from "better-sqlite3";
import { dataDir } from "../security/index.ts";

const require = createRequire(import.meta.url);

export type AppDb = Database;

export function openDatabase(rootDir: string, fileName = "agent.sqlite"): Database {
  const BetterSqlite = require("better-sqlite3") as typeof import("better-sqlite3");
  const dir = dataDir(rootDir);
  const file = fileName === ":memory:" ? ":memory:" : path.join(dir, fileName);
  const db = new BetterSqlite(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db, rootDir);
  seed(db);
  return db;
}

export function migrate(db: Database, rootDir: string): void {
  const schema = fs.readFileSync(path.join(rootDir, "database/schema.sql"), "utf8");
  db.exec(schema);
}

function seed(db: Database): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO users (id, display_name, created_at) VALUES ('local', 'Local user', ?)`,
  ).run(now);
  db.prepare(
    `INSERT OR IGNORE INTO agent_settings
      (id, mode, simulation_enabled, live_send_enabled, emergency_stop, poll_interval_sec, updated_at)
     VALUES ('default', 'approval', 1, 0, 0, 30, ?)`,
  ).run(now);
  for (const platform of ["free4talk", "teams"]) {
    db.prepare(
      `INSERT OR IGNORE INTO platform_connections
        (id, platform, status, last_error, paused, auto_enabled, updated_at)
       VALUES (@id, @platform, 'disconnected', NULL, 0, 0, @now)`,
    ).run({ id: platform, platform, now });
    db.prepare(
      `INSERT OR IGNORE INTO platform_settings (platform, auto_enabled, paused, max_replies_per_hour, updated_at)
       VALUES (@platform, 0, 0, 10, @now)`,
    ).run({ platform, now });
  }
  db.prepare(
    `INSERT OR IGNORE INTO style_profiles (id, name, examples, notes, updated_at)
     VALUES ('default', 'My style', '[]', 'Paste short examples of how you actually write. The model will only use these.', ?)`,
  ).run(now);
}

export function getSettings(db: Database) {
  const row = db.prepare(`SELECT * FROM agent_settings WHERE id = 'default'`).get() as any;
  return {
    mode: row.mode as "draft" | "approval" | "auto",
    simulationEnabled: Boolean(row.simulation_enabled),
    liveSendEnabled: Boolean(row.live_send_enabled),
    emergencyStop: Boolean(row.emergency_stop),
    pollIntervalSec: Number(row.poll_interval_sec),
    updatedAt: row.updated_at as string,
  };
}

export function updateSettings(
  db: Database,
  patch: Partial<{
    mode: "draft" | "approval" | "auto";
    simulationEnabled: boolean;
    liveSendEnabled: boolean;
    emergencyStop: boolean;
    pollIntervalSec: number;
  }>,
) {
  const current = getSettings(db);
  const next = {
    mode: patch.mode ?? current.mode,
    simulation_enabled: (patch.simulationEnabled ?? current.simulationEnabled) ? 1 : 0,
    live_send_enabled: (patch.liveSendEnabled ?? current.liveSendEnabled) ? 1 : 0,
    emergency_stop: (patch.emergencyStop ?? current.emergencyStop) ? 1 : 0,
    poll_interval_sec: patch.pollIntervalSec ?? current.pollIntervalSec,
    updated_at: new Date().toISOString(),
  };
  db.prepare(
    `UPDATE agent_settings SET
      mode = @mode,
      simulation_enabled = @simulation_enabled,
      live_send_enabled = @live_send_enabled,
      emergency_stop = @emergency_stop,
      poll_interval_sec = @poll_interval_sec,
      updated_at = @updated_at
     WHERE id = 'default'`,
  ).run(next);
  return getSettings(db);
}
