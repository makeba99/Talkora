import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase, getSettings, updateSettings } from "../database/index.ts";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("SQLite", () => {
  it("creates required tables and default approval/simulation settings", () => {
    const db = openDatabase(ROOT, ":memory:");
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r: any) => r.name);
    for (const name of [
      "users",
      "platform_connections",
      "platform_sessions",
      "conversations",
      "messages",
      "drafts",
      "agent_settings",
      "platform_settings",
      "conversation_settings",
      "style_profiles",
      "conversation_memory",
      "agent_logs",
      "rate_limits",
    ]) {
      expect(tables).toContain(name);
    }
    const settings = getSettings(db);
    expect(settings.mode).toBe("approval");
    expect(settings.simulationEnabled).toBe(true);
    expect(settings.liveSendEnabled).toBe(false);
    expect(settings.emergencyStop).toBe(false);
    db.close();
  });

  it("persists settings across reopen", () => {
    const file = `persist-${Date.now()}.sqlite`;
    const db1 = openDatabase(ROOT, file);
    updateSettings(db1, { mode: "draft", emergencyStop: true });
    db1.close();
    const db2 = openDatabase(ROOT, file);
    const settings = getSettings(db2);
    expect(settings.mode).toBe("draft");
    expect(settings.emergencyStop).toBe(true);
    db2.close();
  });
});
