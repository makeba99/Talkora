/**
 * Dynamic AI Tutor configuration.
 *
 * Reads provider settings from the `app_settings` DB table with a short
 * in-process TTL cache. Falls back to env vars when no DB config exists.
 * Admin panel writes via setAiTutorConfig() which also invalidates the cache.
 */

import { storage } from "./storage";

export type TtsProvider = "elevenlabs" | "openai" | "huggingface" | "browser";

export type AiTutorConfig = {
  provider: TtsProvider;
  elevenlabs: {
    apiKeys: string;
    voiceId: string;       // female / Eva voice (Lebroskiu or Charlotte etc.)
    maleVoiceId: string;   // male voice (Adam, Daniel, Clyde, etc.)
    modelId: string;
  };
  openai: {
    apiKey: string;
    model: string;
    voice: string;
  };
  huggingface: {
    apiKey: string;
    model: string;
  };
};

const SETTINGS_KEY = "ai_tutor_config";
const CACHE_TTL_MS = 30_000;

let cached: AiTutorConfig | null = null;
let cachedAt = 0;

function envDefaults(): AiTutorConfig {
  const hasElevenLabs = !!(process.env.ELEVENLABS_API_KEYS || process.env.ELEVENLABS_API_KEY);
  const hasOpenAi = !!process.env.OPENAI_API_KEY;
  return {
    provider: hasElevenLabs ? "elevenlabs" : hasOpenAi ? "openai" : "browser",
    elevenlabs: {
      apiKeys: process.env.ELEVENLABS_API_KEYS || process.env.ELEVENLABS_API_KEY || "",
      voiceId: process.env.ELEVENLABS_EVA_VOICE_ID || "XB0fDUnXU5powFXDhCwa",
      maleVoiceId: process.env.ELEVENLABS_MALE_VOICE_ID || "pNInz6obpgDQGcFmaJgB", // Adam
      modelId: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "tts-1",
      voice: "nova",
    },
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY || "",
      model: "facebook/mms-tts-eng",
    },
  };
}

export async function getAiTutorConfig(): Promise<AiTutorConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const raw = await storage.getSetting(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiTutorConfig>;
      const defaults = envDefaults();
      cached = {
        provider: parsed.provider ?? defaults.provider,
        elevenlabs: { ...defaults.elevenlabs, ...parsed.elevenlabs },
        openai: { ...defaults.openai, ...parsed.openai },
        huggingface: { ...defaults.huggingface, ...parsed.huggingface },
      };
    } else {
      cached = envDefaults();
    }
    cachedAt = now;
    return cached;
  } catch {
    return envDefaults();
  }
}

export async function setAiTutorConfig(config: AiTutorConfig): Promise<void> {
  await storage.setSetting(SETTINGS_KEY, JSON.stringify(config));
  cached = config;
  cachedAt = Date.now();
}

export function invalidateAiTutorConfigCache(): void {
  cached = null;
  cachedAt = 0;
}

const MASK_PLACEHOLDER = "••••";

function isMasked(val: string): boolean {
  return val.includes("•");
}

/** Returns a version of the config safe to send to the browser (keys masked). */
export function maskConfig(config: AiTutorConfig): AiTutorConfig {
  const maskKey = (k: string) =>
    k && k.length > 8
      ? `${k.slice(0, 4)}${"•".repeat(12)}${k.slice(-4)}`
      : k
      ? MASK_PLACEHOLDER
      : "";

  return {
    ...config,
    elevenlabs: {
      ...config.elevenlabs,
      maleVoiceId: config.elevenlabs.maleVoiceId || "",
      apiKeys: config.elevenlabs.apiKeys
        ? config.elevenlabs.apiKeys
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean)
            .map(maskKey)
            .join(", ")
        : "",
    },
    openai: { ...config.openai, apiKey: maskKey(config.openai.apiKey) },
    huggingface: {
      ...config.huggingface,
      apiKey: maskKey(config.huggingface.apiKey),
    },
  };
}

/**
 * Merges incoming (possibly masked) form values with the stored config so
 * that a placeholder "••••..." value never overwrites a real key.
 */
export function mergeIncoming(
  current: AiTutorConfig,
  incoming: Partial<AiTutorConfig>,
): AiTutorConfig {
  const keepOrReplace = (stored: string, incoming: string) =>
    isMasked(incoming) ? stored : incoming;

  return {
    provider: incoming.provider ?? current.provider,
    elevenlabs: {
      apiKeys: keepOrReplace(
        current.elevenlabs.apiKeys,
        incoming.elevenlabs?.apiKeys ?? "",
      ),
      voiceId: incoming.elevenlabs?.voiceId ?? current.elevenlabs.voiceId,
      maleVoiceId: incoming.elevenlabs?.maleVoiceId ?? current.elevenlabs.maleVoiceId,
      modelId: incoming.elevenlabs?.modelId ?? current.elevenlabs.modelId,
    },
    openai: {
      apiKey: keepOrReplace(
        current.openai.apiKey,
        incoming.openai?.apiKey ?? "",
      ),
      model: incoming.openai?.model ?? current.openai.model,
      voice: incoming.openai?.voice ?? current.openai.voice,
    },
    huggingface: {
      apiKey: keepOrReplace(
        current.huggingface.apiKey,
        incoming.huggingface?.apiKey ?? "",
      ),
      model: incoming.huggingface?.model ?? current.huggingface.model,
    },
  };
}
