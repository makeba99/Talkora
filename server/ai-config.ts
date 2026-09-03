/**
 * AI Tutor configuration (v2) — Brain + Voice with primary/secondary keys.
 *
 * Free-friendly defaults:
 * - Brain: Groq (OpenAI-compatible, free tier) when GROQ_API_KEY is set
 * - Voice: browser SpeechSynthesis when no OpenAI TTS keys (free forever)
 *
 * Persisted in app_settings under key `ai_tutor_config`.
 * Secrets stay server-side; the admin UI only ever receives masked values.
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

export type BrainProvider = "openai" | "groq";
export type VoiceProvider = "openai" | "browser";

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

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
export const DEFAULT_OPENAI_MODEL = "gpt-4o";

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

export function isGroqKey(key: string): boolean {
  return /^gsk_/i.test(sanitizeKey(key));
}

/** Resolve OpenAI-compatible base URL + model for a specific brain key. */
export function resolveBrainEndpoint(
  key: string,
  cfg: AiTutorConfig,
): { baseUrl: string; model: string; provider: BrainProvider } {
  const useGroq = cfg.brain.provider === "groq" || isGroqKey(key);
  if (useGroq) {
    const model =
      !cfg.brain.model || /^gpt-/i.test(cfg.brain.model)
        ? DEFAULT_GROQ_MODEL
        : cfg.brain.model;
    return { baseUrl: GROQ_BASE_URL, model, provider: "groq" };
  }
  const baseUrl =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim() || OPENAI_BASE_URL;
  const model = cfg.brain.model || DEFAULT_OPENAI_MODEL;
  return { baseUrl, model, provider: "openai" };
}

function envOpenAiKey(): string {
  return (
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.AI_BRAIN_KEY_1 ||
    ""
  ).trim();
}

function envGroqKey(): string {
  return (
    process.env.GROQ_API_KEY ||
    process.env.AI_GROQ_API_KEY ||
    process.env.AI_BRAIN_GROQ_KEY ||
    ""
  ).trim();
}

function envDefaults(): AiTutorConfig {
  const openAi = sanitizeKey(envOpenAiKey());
  const groq = sanitizeKey(envGroqKey());
  const brain2 = sanitizeKey(process.env.AI_BRAIN_KEY_2 || "");
  // Prefer OpenAI if present; otherwise free Groq. Secondary can be the other provider.
  const primary = openAi || groq;
  const secondary =
    brain2 ||
    (openAi && groq ? groq : "") ||
    sanitizeKey(process.env.AI_BRAIN_KEY_2 || "");
  const provider: BrainProvider =
    (process.env.AI_BRAIN_PROVIDER as BrainProvider) ||
    (primary && isGroqKey(primary) ? "groq" : openAi ? "openai" : groq ? "groq" : "openai");
  const model =
    process.env.AI_BRAIN_MODEL ||
    (provider === "groq" ? DEFAULT_GROQ_MODEL : DEFAULT_OPENAI_MODEL);

  const voice1 = sanitizeKey(process.env.AI_VOICE_KEY_1 || "");
  const voice2 = sanitizeKey(process.env.AI_VOICE_KEY_2 || "");
  // Free by default: browser TTS unless an explicit voice key (or shared OpenAI) is set
  const hasPaidVoice = !!(voice1 || (openAi && process.env.AI_VOICE_USE_OPENAI === "1"));
  const voiceProvider: VoiceProvider =
    (process.env.AI_VOICE_PROVIDER as VoiceProvider) ||
    (hasPaidVoice || voice1 ? "openai" : "browser");

  return {
    version: 2,
    brain: {
      provider,
      primaryKey: primary,
      secondaryKey: secondary || (openAi && groq && primary === openAi ? groq : ""),
      model,
      warnThresholdPct: 80,
    },
    voice: {
      provider: voiceProvider,
      primaryKey: voice1 || (voiceProvider === "openai" ? openAi : ""),
      secondaryKey: voice2 || (voiceProvider === "openai" ? brain2 : ""),
      femaleVoice: process.env.AI_VOICE_FEMALE || "nova",
      maleVoice: process.env.AI_VOICE_MALE || "onyx",
      model: process.env.AI_VOICE_MODEL || "tts-1-hd",
      warnThresholdPct: 80,
    },
  };
}

function asBrainProvider(v: any, fallback: BrainProvider): BrainProvider {
  return v === "groq" || v === "openai" ? v : fallback;
}

function asVoiceProvider(v: any, fallback: VoiceProvider): VoiceProvider {
  return v === "browser" || v === "openai" ? v : fallback;
}

/** Migrate legacy v1 admin config into v2 Brain/Voice shape. */
function migrateLegacy(raw: any, defaults: AiTutorConfig): AiTutorConfig {
  if (raw?.version === 2 && raw?.brain && raw?.voice) {
    return {
      version: 2,
      brain: {
        provider: asBrainProvider(raw.brain.provider, defaults.brain.provider),
        primaryKey: String(raw.brain.primaryKey ?? defaults.brain.primaryKey ?? ""),
        secondaryKey: String(raw.brain.secondaryKey ?? defaults.brain.secondaryKey ?? ""),
        model: String(raw.brain.model || defaults.brain.model),
        warnThresholdPct: Number(raw.brain.warnThresholdPct) || 80,
      },
      voice: {
        provider: asVoiceProvider(raw.voice.provider, defaults.voice.provider),
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
  const v1Tts = String(raw?.provider || "");
  return {
    version: 2,
    brain: {
      provider: defaults.brain.provider,
      primaryKey: primary,
      secondaryKey: secondary || defaults.brain.secondaryKey,
      model: defaults.brain.model,
      warnThresholdPct: 80,
    },
    voice: {
      provider: v1Tts === "browser" ? "browser" : defaults.voice.provider,
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
  const primaryKey = sanitizeKey(cfg.brain.primaryKey) || d.brain.primaryKey;
  const secondaryKey = sanitizeKey(cfg.brain.secondaryKey) || d.brain.secondaryKey;
  let provider = asBrainProvider(cfg.brain.provider, d.brain.provider);
  if (isGroqKey(primaryKey) && provider === "openai" && !sanitizeKey(envOpenAiKey())) {
    provider = "groq";
  }
  return {
    version: 2,
    brain: {
      ...cfg.brain,
      provider,
      primaryKey,
      secondaryKey,
      model: cfg.brain.model || d.brain.model,
      warnThresholdPct: cfg.brain.warnThresholdPct || 80,
    },
    voice: {
      ...cfg.voice,
      provider: asVoiceProvider(cfg.voice.provider, d.voice.provider),
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
  const brainProvider = asBrainProvider(config.brain.provider, "openai");
  const voiceProvider = asVoiceProvider(config.voice.provider, "browser");
  const normalized: AiTutorConfig = {
    version: 2,
    brain: {
      provider: brainProvider,
      primaryKey: config.brain.primaryKey || "",
      secondaryKey: config.brain.secondaryKey || "",
      model:
        config.brain.model ||
        (brainProvider === "groq" ? DEFAULT_GROQ_MODEL : DEFAULT_OPENAI_MODEL),
      warnThresholdPct: [80, 90, 95].includes(config.brain.warnThresholdPct)
        ? config.brain.warnThresholdPct
        : 80,
    },
    voice: {
      provider: voiceProvider,
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
      provider: config.brain.provider,
      primaryKeyMasked: maskKey(config.brain.primaryKey),
      secondaryKeyMasked: maskKey(config.brain.secondaryKey),
      hasPrimary: !!sanitizeKey(config.brain.primaryKey),
      hasSecondary: !!sanitizeKey(config.brain.secondaryKey),
      model: config.brain.model,
      warnThresholdPct: config.brain.warnThresholdPct,
    },
    voice: {
      provider: config.voice.provider,
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
 * Empty string keeps the stored key; "__CLEAR__" clears it.
 */
export function mergeIncoming(
  current: AiTutorConfig,
  incoming: any,
): AiTutorConfig {
  const keepOrReplace = (stored: string, next: string | undefined, clearToken = "__CLEAR__") => {
    if (next === undefined) return stored;
    if (next === clearToken) return "";
    if (next === "") return stored;
    if (isMasked(next)) return stored;
    return next;
  };

  if (incoming?.brain || incoming?.voice) {
    const brainProvider = asBrainProvider(
      incoming.brain?.provider,
      current.brain.provider,
    );
    const voiceProvider = asVoiceProvider(
      incoming.voice?.provider,
      current.voice.provider,
    );
    return {
      version: 2,
      brain: {
        provider: brainProvider,
        primaryKey: keepOrReplace(current.brain.primaryKey, incoming.brain?.primaryKey),
        secondaryKey: keepOrReplace(current.brain.secondaryKey, incoming.brain?.secondaryKey),
        model: incoming.brain?.model ?? current.brain.model,
        warnThresholdPct: Number(incoming.brain?.warnThresholdPct) || current.brain.warnThresholdPct,
      },
      voice: {
        provider: voiceProvider,
        primaryKey: keepOrReplace(current.voice.primaryKey, incoming.voice?.primaryKey),
        secondaryKey: keepOrReplace(current.voice.secondaryKey, incoming.voice?.secondaryKey),
        femaleVoice: incoming.voice?.femaleVoice ?? current.voice.femaleVoice,
        maleVoice: incoming.voice?.maleVoice ?? current.voice.maleVoice,
        model: incoming.voice?.model ?? current.voice.model,
        warnThresholdPct: Number(incoming.voice?.warnThresholdPct) || current.voice.warnThresholdPct,
      },
    };
  }

  const oai = keepOrReplace(current.brain.primaryKey, incoming?.openai?.apiKey);
  return {
    version: 2,
    brain: {
      provider: current.brain.provider,
      primaryKey: oai,
      secondaryKey: current.brain.secondaryKey,
      model: current.brain.model,
      warnThresholdPct: current.brain.warnThresholdPct,
    },
    voice: {
      provider: current.voice.provider,
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
