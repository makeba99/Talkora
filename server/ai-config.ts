/**
 * Dynamic AI Tutor configuration.
 *
 * Reads provider settings from the `app_settings` DB table with a short
 * in-process TTL cache. Falls back to env vars when no DB config exists.
 * Admin panel writes via setAiTutorConfig() which also invalidates the cache.
 *
 * Provider priority for NEW installs (no DB row yet):
 *   1. OpenAI TTS — uses the same OPENAI_API_KEY as chat (nova/onyx)
 *   2. Browser — free forever, never expires
 *   3. ElevenLabs only if explicitly chosen (quota expires)
 */

import { storage } from "./storage";

export type TtsProvider = "elevenlabs" | "openai" | "huggingface" | "browser";

export type AiTutorConfig = {
  provider: TtsProvider;
  elevenlabs: {
    apiKeys: string;
    voiceId: string;       // female / Maya voice
    maleVoiceId: string;   // male / Miles voice
    modelId: string;
  };
  openai: {
    apiKey: string;
    model: string;
    voice: string;       // female (Maya) — default nova
    maleVoice: string;   // male (Miles) — default onyx
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

function envDefaults(): AiTutorConfig {
  const openAiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  // Prefer OpenAI (same key as chat) or free browser — not ElevenLabs by default,
  // because free-tier ElevenLabs keys expire / run out of credits constantly.
  const provider: TtsProvider = openAiKey.trim() ? "openai" : "browser";
  return {
    provider,
    elevenlabs: {
      apiKeys: process.env.ELEVENLABS_API_KEYS || process.env.ELEVENLABS_API_KEY || "",
      voiceId: process.env.ELEVENLABS_EVA_VOICE_ID || "XB0fDUnXU5powFXDhCwa", // Charlotte ≈ Maya-like
      maleVoiceId: process.env.ELEVENLABS_MALE_VOICE_ID || "pNInz6obpgDQGcFmaJgB", // Adam
      modelId: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
    },
    openai: {
      apiKey: openAiKey,
      model: "tts-1-hd",
      voice: "nova",
      maleVoice: "onyx",
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
      const openaiMerged = { ...defaults.openai, ...parsed.openai };
      // If DB key is empty/masked, keep using env OpenAI key for chat+TTS.
      if (!sanitizeSecretList(openaiMerged.apiKey).length && defaults.openai.apiKey) {
        openaiMerged.apiKey = defaults.openai.apiKey;
      }
      if (!openaiMerged.maleVoice) openaiMerged.maleVoice = "onyx";
      cached = {
        provider: parsed.provider ?? defaults.provider,
        elevenlabs: { ...defaults.elevenlabs, ...parsed.elevenlabs },
        openai: openaiMerged,
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
    openai: {
      ...config.openai,
      maleVoice: config.openai.maleVoice || "onyx",
      apiKey: maskKey(config.openai.apiKey),
    },
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
      maleVoice: incoming.openai?.maleVoice ?? current.openai.maleVoice ?? "onyx",
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
