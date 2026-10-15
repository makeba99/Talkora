import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface SecretStore {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}

const NAME = /^[a-z0-9-]{1,40}$/;

export class MemorySecretStore implements SecretStore {
  private values = new Map<string, string>();
  async get(name: string): Promise<string | null> {
    return this.values.get(name) ?? null;
  }
  async set(name: string, value: string): Promise<void> {
    this.values.set(name, value);
  }
  async delete(name: string): Promise<void> {
    this.values.delete(name);
  }
}

export class FileSecretStore implements SecretStore {
  constructor(private readonly file: string) {}

  async get(name: string): Promise<string | null> {
    return this.read()[name] ?? null;
  }

  async set(name: string, value: string): Promise<void> {
    const data = this.read();
    data[name] = value;
    this.write(data);
  }

  async delete(name: string): Promise<void> {
    const data = this.read();
    delete data[name];
    this.write(data);
  }

  private read(): Record<string, string> {
    if (!existsSync(this.file)) return {};
    const parsed = JSON.parse(readFileSync(this.file, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  }

  private write(data: Record<string, string>): void {
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    writeFileSync(this.file, JSON.stringify(data), { mode: 0o600 });
    try {
      chmodSync(this.file, 0o600);
    } catch {
      // Windows does not honor POSIX modes. The Windows store does not use this file.
    }
  }
}

export class WindowsSecretStore implements SecretStore {
  constructor(
    private readonly dataDir: string,
    private readonly run: (input: { op: string; name: string; value?: string }) => Promise<{ ok: boolean; value?: string | null; error?: string }> = runCredentialScript,
  ) {}

  async get(name: string): Promise<string | null> {
    assertName(name);
    const where = this.locations()[name];
    if (where === "dpapi") return this.readDpapi(name);
    const result = await this.run({ op: "get", name });
    if (!result.ok) throw new Error(result.error || "Credential Manager could not be read.");
    return result.value ?? null;
  }

  async set(name: string, value: string): Promise<void> {
    assertName(name);
    if (Buffer.byteLength(value, "utf16le") > 2000) {
      await this.writeDpapi(name, value);
      this.remember(name, "dpapi");
      return;
    }
    const result = await this.run({ op: "set", name, value });
    if (!result.ok) throw new Error("Could not store the secret in Windows Credential Manager.");
    this.remember(name, "credman");
  }

  async delete(name: string): Promise<void> {
    assertName(name);
    await this.run({ op: "delete", name });
    const file = this.dpapiFile(name);
    if (existsSync(file)) writeFileSync(file, "");
    const locations = this.locations();
    delete locations[name];
    this.writeLocations(locations);
  }

  private async writeDpapi(name: string, value: string): Promise<void> {
    const result = await this.run({ op: "protect", name, value });
    if (!result.ok || !result.value) throw new Error("Could not protect the secret with Windows DPAPI.");
    mkdirSync(this.dataDir, { recursive: true });
    writeFileSync(this.dpapiFile(name), result.value, { encoding: "utf8" });
  }

  private async readDpapi(name: string): Promise<string | null> {
    const file = this.dpapiFile(name);
    if (!existsSync(file)) return null;
    const cipher = readFileSync(file, "utf8").trim();
    if (!cipher) return null;
    const result = await this.run({ op: "unprotect", name, value: cipher });
    if (!result.ok || typeof result.value !== "string") throw new Error("Could not read the protected secret.");
    return result.value;
  }

  private dpapiFile(name: string): string {
    return path.join(this.dataDir, `${name}.dpapi`);
  }

  private locations(): Record<string, "credman" | "dpapi"> {
    const file = path.join(this.dataDir, "secret-locations.json");
    if (!existsSync(file)) return {};
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, "credman" | "dpapi">;
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  private remember(name: string, kind: "credman" | "dpapi"): void {
    const locations = this.locations();
    locations[name] = kind;
    this.writeLocations(locations);
  }

  private writeLocations(locations: Record<string, "credman" | "dpapi">): void {
    mkdirSync(this.dataDir, { recursive: true });
    writeFileSync(path.join(this.dataDir, "secret-locations.json"), JSON.stringify(locations), { encoding: "utf8" });
  }
}

export function createSecretStore(dataDir: string): SecretStore {
  if (process.platform === "win32" && process.env.TEAMSPILOT_SECRET_STORE !== "file") {
    return new WindowsSecretStore(dataDir);
  }
  return new FileSecretStore(path.join(dataDir, "secrets.json"));
}

function assertName(name: string): void {
  if (!NAME.test(name)) throw new Error("Invalid secret name.");
}

function scriptPath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "credential-manager.ps1"),
    path.resolve(moduleDir, "../../dist/credential-manager.ps1"),
    path.resolve(process.cwd(), "src/security/credential-manager.ps1"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function runCredentialScript(input: { op: string; name: string; value?: string }): Promise<{ ok: boolean; value?: string | null; error?: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath()],
      { timeout: 20_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(new Error("Credential Manager could not be reached."));
          return;
        }
        try {
          resolve(JSON.parse(stdout) as { ok: boolean; value?: string | null; error?: string });
        } catch {
          reject(new Error("Credential Manager returned an unreadable result."));
        }
      },
    );
    child.stdin?.write(JSON.stringify(input));
    child.stdin?.end();
  });
}
