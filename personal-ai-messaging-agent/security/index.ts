import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const KEY_FILE = "data/.agent-data-key";

export function loadEnvFile(rootDir: string): void {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function host(): string {
  return process.env.HOST || "127.0.0.1";
}

export function port(): number {
  return Number(process.env.PORT || 8787);
}

export function frontendPort(): number {
  return Number(process.env.FRONTEND_PORT || 5173);
}

export function assertLocalhostBind(bindHost: string): void {
  const allowed = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!allowed.has(bindHost)) {
    throw new Error(`Refusing to bind to ${bindHost}. This app is local-only (127.0.0.1).`);
  }
}

export function dataDir(rootDir: string): string {
  const dir = path.join(rootDir, "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function keyBytes(rootDir: string): Buffer {
  const fromEnv = process.env.AGENT_DATA_KEY?.trim();
  if (fromEnv) {
    if (/^[0-9a-fA-F]{64}$/.test(fromEnv)) return Buffer.from(fromEnv, "hex");
    return crypto.createHash("sha256").update(fromEnv).digest();
  }
  const file = path.join(rootDir, KEY_FILE);
  if (fs.existsSync(file)) return Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key.toString("hex"), { mode: 0o600 });
  return key;
}

export function encryptSecret(rootDir: string, plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(rootDir), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(rootDir: string, payload: string): string {
  const [version, ivHex, tagHex, dataHex] = payload.split(":");
  if (version !== "v1" || !ivHex || !tagHex || !dataHex) {
    throw new Error("Unrecognized secret payload");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes(rootDir), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}

const SECRET_KEYS = ["access_token", "refresh_token", "id_token", "cookie", "cookies", "password", "secret", "authorization"];

export function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.some((s) => k.toLowerCase().includes(s)) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

function redactString(s: string): string {
  if (/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\./.test(s)) return "[redacted-token]";
  if (s.length > 24 && /^[A-Za-z0-9+/=._-]{32,}$/.test(s)) return "[redacted]";
  return s;
}

export function teamsClientId(): string | undefined {
  const id = process.env.TEAMS_CLIENT_ID?.trim();
  return id || undefined;
}

export function teamsTenantId(): string {
  return process.env.TEAMS_TENANT_ID?.trim() || "organizations";
}

export function openaiConfig(): { apiKey?: string; baseUrl: string; model: string } {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    baseUrl: (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  };
}
