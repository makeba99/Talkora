import os from "node:os";
import path from "node:path";

export function defaultDataDir(): string {
  if (process.env.TEAMSPILOT_DATA_DIR) return path.resolve(process.env.TEAMSPILOT_DATA_DIR);
  if (process.platform === "win32") {
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, "TeamsPilot");
  }
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "TeamsPilot");
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "TeamsPilot");
}
