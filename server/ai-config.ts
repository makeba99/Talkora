/**
 * AI Tutor configuration (v2) — Brain + Voice with primary/secondary keys.
 *
 * Persisted in app_settings under key `ai_tutor_config`.
 * Secrets stay server-side; the admin UI only ever receives masked values.
 *
 * Legacy v1 configs (provider/elevenlabs/openai/huggingface) are migrated
 * automatically on read so existing Railway/DB secrets keep working.
 */

import { storage } from "./storage";

export type KeyHealth =
  | "HEALTHY"
  | "WARNING"
  | "RATE_LIMITED"
  | "QUOTA_EXHAUSTED"
  | "INVALID"
  | "EXPIRED"
  | "ERROR"
  | "UNKNOWN";

export type BrainProvider = "openai";
export type VoiceProvider = "openai";

export type AiTutorConfig = {
  version: 2;
  brain: {
    provider: BrainProvider;
    primaryKey: string;
    secondaryKey: string;
    model: string;
    warnThresholdPct: number;
  };
  voice: {
    provider: VoiceProvider;
    primaryKey: string;
    secondaryKey: string;
    femaleVoice: string;
    maleVoice: string;
    model: string;
    warnThresholdPct: number;
  };
};

/** Public (masked) view returned to the admin UI — never includes full secrets. */
export type AiTutorConfigPublic = {
  version: 2;
  brain: {
    provider: BrainProvider;
    primaryKeyMasked: string;
    secondaryKeyMasked: string;
    hasPrimary: boolean;
    hasSecondary: boolean;
    model: string;
    warnThresholdPct: number;
  };
  voice: {
    provider: VoiceProvider;
    primaryKeyMasked: string;
    secondaryKeyMasked: string;
    hasPrimary: boolean;
    hasSecondary: boolean;
    femaleVoice: string;
    maleVoice: string;
    model: string;
    warnThresholdPct: number;
  };
};

const SETTINGS_KEY = "ai_tutor_config";
const CACHE_TTL_MS = 15_000;

let cached: AiTutorConfig | null = null;
let cachedAt = 0;

/** Strip quotes / header prefixes; drop masked placeholders. */
export function sanitizeSecretList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]+/)
    .map((s) =>
      s
        .trim()
        .replace(/^["']+|["']+$/g, "")
        .replace(/^xi-api-key\s*[:=]\s*/i, "")
        .replace(/^Bearer\s+/i, "")
        .trim(),
    )
    .filter((s) => s.length > 8 && !s.includes("•") && s !== "your-giphy-key");
}

export function sanitizeKey(raw: string | null | undefined): string {
  return sanitizeSecretList(raw)[0] || "";
}

function maskKey(k: string): string {
  if (!k) return "";
  if (k.length > 8) return `${k.slice(0, 4)}${"•".repeat(12)}${k.slice(-4)}`;
  return "••••";
}

function isMasked(val: string): boolean {
  return !val || val.includes("•");
}

function envOpenAiKey(): string {
  return (
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.AI_BRAIN_KEY_1 ||
    ""
  ).trim();
}

function envDefaults(): AiTutorConfig {
  const openAi = envOpenAiKey();
  const brain2 = (process.env.AI_BRAIN_KEY_2 || "").trim();
  const voice1 = (process.env.AI_VOICE_KEY_1 || openAi).trim();
  const voice2 = (process.env.AI_VOICE_KEY_2 || brain2 || "").trim();
  return {
    version: 2,
    brain: {
      provider: "openai",
      primaryKey: openAi,
      secondaryKey: brain2,
      model: process.env.AI_BRAIN_MODEL || "gpt-4o",
      warnThresholdPct: 80,
    },
    voice: {
      provider: "openai",
      primaryKey: voice1,
      secondaryKey: voice2,
      femaleVoice: process.env.AI_VOICE_FEMALE || "nova",
      maleVoice: process.env.AI_VOICE_MALE || "onyx",
      model: process.env.AI_VOICE_MODEL || "tts-1-hd",
      warnThresholdPct: 80,
    },
  };
}

/** Migrate legacy v1 admin config into v2 Brain/Voice shape. */
function migrateLegacy(raw: any, defaults: AiTutorConfig): AiTutorConfig {
  if (raw?.version === 2 && raw?.brain && raw?.voice) {
    return {
      version: 2,
      brain: {
        provider: "openai",
        primaryKey: String(raw.brain.primaryKey ?? defaults.brain.primaryKey ?? ""),
        secondaryKey: String(raw.brain.secondaryKey ?? defaults.brain.secondaryKey ?? ""),
        model: String(raw.brain.model || defaults.brain.model),
        warnThresholdPct: Number(raw.brain.warnThresholdPct) || 80,
      },
      voice: {
        provider: "openai",
        primaryKey: String(raw.voice.primaryKey ?? defaults.voice.primaryKey ?? ""),
        secondaryKey: String(raw.voice.secondaryKey ?? defaults.voice.secondaryKey ?? ""),
        femaleVoice: String(raw.voice.femaleVoice || raw.voice.voice || defaults.voice.femaleVoice),
        maleVoice: String(raw.voice.maleVoice || defaults.voice.maleVoice),
        model: String(raw.voice.model || defaults.voice.model),
        warnThresholdPct: Number(raw.voice.warnThresholdPct) || 80,
      },
    };
  }

  // v1 shape: { provider, openai, elevenlabs, huggingface }
  const oaiKey = String(raw?.openai?.apiKey || "");
  const elKeys = sanitizeSecretList(raw?.elevenlabs?.apiKeys);
  const primary = sanitizeKey(oaiKey) || defaults.brain.primaryKey;
  const secondary = elKeys[1] || defaults.brain.secondaryKey;
  return {
    version: 2,
    brain: {
      provider: "openai",
      primaryKey: primary,
      secondaryKey: secondary || defaults.brain.secondaryKey,
      model: defaults.brain.model,
      warnThresholdPct: 80,
    },
    voice: {
      provider: "openai",
      primaryKey: primary || defaults.voice.primaryKey,
      secondaryKey: secondary || defaults.voice.secondaryKey,
      femaleVoice: String(raw?.openai?.voice || defaults.voice.femaleVoice),
      maleVoice: String(raw?.openai?.maleVoice || defaults.voice.maleVoice),
      model: String(raw?.openai?.model || defaults.voice.model),
      warnThresholdPct: 80,
    },
  };
}

function fillEmptyFromEnv(cfg: AiTutorConfig): AiTutorConfig {
  const d = envDefaults();
  return {
    version: 2,
    brain: {
      ...cfg.brain,
      primaryKey: sanitizeKey(cfg.brain.primaryKey) || d.brain.primaryKey,
      secondaryKey: sanitizeKey(cfg.brain.secondaryKey) || d.brain.secondaryKey,
      model: cfg.brain.model || d.brain.model,
      warnThresholdPct: cfg.brain.warnThresholdPct || 80,
    },
    voice: {
      ...cfg.voice,
      primaryKey: sanitizeKey(cfg.voice.primaryKey) || d.voice.primaryKey,
      secondaryKey: sanitizeKey(cfg.voice.secondaryKey) || d.voice.secondaryKey,
      femaleVoice: cfg.voice.femaleVoice || d.voice.femaleVoice,
      maleVoice: cfg.voice.maleVoice || d.voice.maleVoice,
      model: cfg.voice.model || d.voice.model,
      warnThresholdPct: cfg.voice.warnThresholdPct || 80,
    },
  };
}

export async function getAiTutorConfig(): Promise<AiTutorConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const raw = await storage.getSetting(SETTINGS_KEY);
    const defaults = envDefaults();
    if (raw) {
      const parsed = JSON.parse(raw);
      cached = fillEmptyFromEnv(migrateLegacy(parsed, defaults));
    } else {
      cached = defaults;
    }
    cachedAt = now;
    return cached;
  } catch {
    return envDefaults();
  }
}

export async function setAiTutorConfig(config: AiTutorConfig): Promise<void> {
  const normalized: AiTutorConfig = {
    version: 2,
    brain: {
      provider: "openai",
      primaryKey: config.brain.primaryKey || "",
      secondaryKey: config.brain.secondaryKey || "",
      model: config.brain.model || "gpt-4o",
      warnThresholdPct: [80, 90, 95].includes(config.brain.warnThresholdPct)
        ? config.brain.warnThresholdPct
        : 80,
    },
    voice: {
      provider: "openai",
      primaryKey: config.voice.primaryKey || "",
      secondaryKey: config.voice.secondaryKey || "",
      femaleVoice: config.voice.femaleVoice || "nova",
      maleVoice: config.voice.maleVoice || "onyx",
      model: config.voice.model || "tts-1-hd",
      warnThresholdPct: [80, 90, 95].includes(config.voice.warnThresholdPct)
        ? config.voice.warnThresholdPct
        : 80,
    },
  };
  await storage.setSetting(SETTINGS_KEY, JSON.stringify(normalized));
  cached = fillEmptyFromEnv(normalized);
  cachedAt = Date.now();
}

export function invalidateAiTutorConfigCache(): void {
  cached = null;
  cachedAt = 0;
}

export function maskConfig(config: AiTutorConfig): AiTutorConfigPublic {
  return {
    version: 2,
    brain: {
      provider: "openai",
      primaryKeyMasked: maskKey(config.brain.primaryKey),
      secondaryKeyMasked: maskKey(config.brain.secondaryKey),
      hasPrimary: !!sanitizeKey(config.brain.primaryKey),
      hasSecondary: !!sanitizeKey(config.brain.secondaryKey),
      model: config.brain.model,
      warnThresholdPct: config.brain.warnThresholdPct,
    },
    voice: {
      provider: "openai",
      primaryKeyMasked: maskKey(config.voice.primaryKey),
      secondaryKeyMasked: maskKey(config.voice.secondaryKey),
      hasPrimary: !!sanitizeKey(config.voice.primaryKey),
      hasSecondary: !!sanitizeKey(config.voice.secondaryKey),
      femaleVoice: config.voice.femaleVoice,
      maleVoice: config.voice.maleVoice,
      model: config.voice.model,
      warnThresholdPct: config.voice.warnThresholdPct,
    },
  };
}

/**
 * Merge admin form values with stored secrets.
 * Masked placeholders never overwrite real keys.
 * Empty string on a "replace" field clears the key.
 */
export function mergeIncoming(
  current: AiTutorConfig,
  incoming: any,
): AiTutorConfig {
  const keepOrReplace = (stored: string, next: string | undefined, clearToken = "__CLEAR__") => {
    if (next === undefined) return stored;
    if (next === clearToken || next === "") return next === clearToken ? "" : stored;
    if (isMasked(next)) return stored;
    return next;
  };

  // Support both v2 incoming and accidental legacy payloads.
  if (incoming?.brain || incoming?.voice) {
    return {
      version: 2,
      brain: {
        provider: "openai",
        primaryKey: keepOrReplace(current.brain.primaryKey, incoming.brain?.primaryKey),
        secondaryKey: keepOrReplace(current.brain.secondaryKey, incoming.brain?.secondaryKey),
        model: incoming.brain?.model ?? current.brain.model,
        warnThresholdPct: Number(incoming.brain?.warnThresholdPct) || current.brain.warnThresholdPct,
      },
      voice: {
        provider: "openai",
        primaryKey: keepOrReplace(current.voice.primaryKey, incoming.voice?.primaryKey),
        secondaryKey: keepOrReplace(current.voice.secondaryKey, incoming.voice?.secondaryKey),
        femaleVoice: incoming.voice?.femaleVoice ?? current.voice.femaleVoice,
        maleVoice: incoming.voice?.maleVoice ?? current.voice.maleVoice,
        model: incoming.voice?.model ?? current.voice.model,
        warnThresholdPct: Number(incoming.voice?.warnThresholdPct) || current.voice.warnThresholdPct,
      },
    };
  }

  // Legacy admin form → map into v2
  const oai = keepOrReplace(current.brain.primaryKey, incoming?.openai?.apiKey);
  return {
    version: 2,
    brain: {
      provider: "openai",
      primaryKey: oai,
      secondaryKey: current.brain.secondaryKey,
      model: current.brain.model,
      warnThresholdPct: current.brain.warnThresholdPct,
    },
    voice: {
      provider: "openai",
      primaryKey: oai || current.voice.primaryKey,
      secondaryKey: current.voice.secondaryKey,
      femaleVoice: incoming?.openai?.voice ?? current.voice.femaleVoice,
      maleVoice: incoming?.openai?.maleVoice ?? current.voice.maleVoice,
      model: incoming?.openai?.model ?? current.voice.model,
      warnThresholdPct: current.voice.warnThresholdPct,
    },
  };
}

/** Helpers used by voice-config client endpoint (backward compatible fields). */
export function voiceConfigPublic(cfg: AiTutorConfig) {
  return {
    provider: cfg.voice.provider,
    voiceId: cfg.voice.femaleVoice,
    maleVoiceId: cfg.voice.maleVoice,
  };
}
