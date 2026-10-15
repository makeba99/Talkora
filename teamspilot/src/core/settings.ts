import { z } from "zod";
import { COMMUNICATION_STYLES, RECOMMENDED_MODEL, type Settings } from "./types.js";
import { UserFacingError } from "./types.js";

export const DEFAULT_SETTINGS: Settings = {
  model: RECOMMENDED_MODEL,
  style: "professional",
  languageMode: "match",
  fixedLanguage: "",
  pollIntervalMs: 5000,
  logMessageContent: false,
  followTeamsWindow: false,
  monitoredChatId: null,
  monitoredChatLabel: "",
  graphClientId: "",
  graphTenant: "organizations",
};

const modelSchema = z
  .string()
  .regex(/^[A-Za-z0-9_.:/-]{1,80}$/, "Enter a model id such as gpt-4o-mini.");

const settingsShape = {
  model: modelSchema,
  style: z.enum(COMMUNICATION_STYLES),
  languageMode: z.enum(["match", "fixed"]),
  fixedLanguage: z.string().max(60),
  pollIntervalMs: z.number().int().min(3000).max(120_000),
  logMessageContent: z.boolean(),
  followTeamsWindow: z.boolean(),
  monitoredChatId: z.string().min(1).max(400).nullable(),
  monitoredChatLabel: z.string().max(200),
  graphClientId: z.string().regex(/^$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  graphTenant: z.string().regex(/^[A-Za-z0-9.-]{1,120}$/),
};

export const settingsSchema = z.object(settingsShape).strict();
export const settingsPatchSchema = z.object(settingsShape).partial().strict();

const STORED_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

export function parseStoredSettings(input: unknown): { settings: Settings; ignoredAutoSend: boolean } {
  const ignoredAutoSend = Boolean(input && typeof input === "object" && "autoSend" in input);
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const picked: Record<string, unknown> = {};
  for (const key of STORED_KEYS) {
    if (key in source) picked[key] = source[key];
  }
  const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...picked });
  if (!parsed.success) return { settings: { ...DEFAULT_SETTINGS }, ignoredAutoSend };
  return { settings: parsed.data, ignoredAutoSend };
}

export function applySettingsPatch(current: Settings, patch: unknown): Settings {
  if (patch && typeof patch === "object" && "autoSend" in patch) {
    throw new UserFacingError("Automatic sending is not supported.", "auto_send_rejected", 400);
  }
  const parsed = settingsPatchSchema.safeParse(patch);
  if (!parsed.success) {
    throw new UserFacingError("Check the settings fields and try again.", "invalid_settings", 400);
  }
  return settingsSchema.parse({ ...current, ...parsed.data });
}

export function isPlaceholderSecret(value: string): boolean {
  return /your-key|placeholder|replace-me|changeme|example/i.test(value);
}
