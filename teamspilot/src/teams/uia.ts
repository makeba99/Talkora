import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatSummary } from "../core/types.js";
import { interpretProbe, type ProbeInterpretation } from "./match-chat.js";

export type { ProbeInterpretation };

function scriptPath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "probe-teams.ps1"),
    path.resolve(moduleDir, "../../dist/probe-teams.ps1"),
    path.resolve(process.cwd(), "src/teams/probe-teams.ps1"),
  ];
  return candidates.find((candidate) => {
    try {
      readFileSync(candidate);
      return true;
    } catch {
      return false;
    }
  }) ?? candidates[0];
}

export async function probeTeamsWindow(chats: ChatSummary[]): Promise<ProbeInterpretation> {
  if (process.platform !== "win32") {
    return interpretProbe(
      {
        supported: false,
        teamsWindowFound: false,
        windowTitle: null,
        selectedLabels: [],
        messageTextExposed: false,
        composerFound: false,
        notes: [],
      },
      chats,
    );
  }
  try {
    const stdout = await runProbe(scriptPath());
    const parsed = parseProbeOutput(stdout);
    return interpretProbe(parsed, chats);
  } catch {
    return interpretProbe(
      {
        supported: true,
        teamsWindowFound: false,
        windowTitle: null,
        selectedLabels: [],
        messageTextExposed: false,
        composerFound: false,
        notes: ["The UI Automation probe did not return a usable result. The monitored chat was left unchanged."],
      },
      chats,
    );
  }
}

export function parseProbeOutput(stdout: string): {
  supported: boolean;
  teamsWindowFound: boolean;
  windowTitle: string | null;
  selectedLabels: string[];
  messageTextExposed: boolean;
  composerFound: boolean;
  notes: string[];
} {
  const match = stdout.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("unreadable probe");
  const body = JSON.parse(match[0]) as Record<string, unknown>;
  return {
    supported: true,
    teamsWindowFound: body.teamsWindowFound === true,
    windowTitle: typeof body.windowTitle === "string" ? body.windowTitle : null,
    selectedLabels: asStrings(body.selectedLabels),
    messageTextExposed: body.messageTextExposed === true,
    composerFound: body.composerFound === true,
    notes: asStrings(body.notes),
  };
}

function asStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function runProbe(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file],
      { timeout: 12_000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
}
