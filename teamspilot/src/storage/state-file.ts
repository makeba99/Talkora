import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyState } from "../core/store.js";
import { parseStoredSettings } from "../core/settings.js";
import type { AppState } from "../core/types.js";

export function loadState(file: string): { state: AppState; ignoredAutoSend: boolean; resetSettings: boolean } {
  if (!existsSync(file)) return { state: emptyState(), ignoredAutoSend: false, resetSettings: false };
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<AppState>;
    const stored = parseStoredSettings(parsed.settings);
    const state = emptyState(stored.settings);
    state.drafts = Array.isArray(parsed.drafts) ? parsed.drafts : [];
    state.processedIds = Array.isArray(parsed.processedIds) ? parsed.processedIds.filter((id) => typeof id === "string") : [];
    state.cursors = parsed.cursors && typeof parsed.cursors === "object" ? parsed.cursors : {};
    state.activity = Array.isArray(parsed.activity) ? parsed.activity : [];
    return { state, ignoredAutoSend: stored.ignoredAutoSend, resetSettings: false };
  } catch {
    const broken = `${file}.unreadable`;
    try {
      renameSync(file, broken);
    } catch {
      // Keep going with an empty inbox. The unreadable file may contain conversation text, so it is not logged.
    }
    return { state: emptyState(), ignoredAutoSend: false, resetSettings: true };
  }
}

export function persistState(file: string, state: AppState): void {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
  try {
    chmodSync(tmp, 0o600);
  } catch {
    // POSIX modes are not meaningful on every Windows filesystem.
  }
  renameSync(tmp, file);
}
