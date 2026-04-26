/**
 * ElevenLabs TTS proxy with multi-key rotation — used to power the AI Tutor
 * "Eva" persona.
 *
 * Multi-key pooling: provide a comma-separated list of API keys to multiply
 * the free-tier quota. The proxy rotates round-robin and automatically skips
 * keys that hit a quota/auth error, retrying with the next available key for
 * the same request. Exhausted keys cool down for 1 hour before being retried.
 *
 * Env:
 *   ELEVENLABS_API_KEYS       — comma-separated list of API keys (preferred)
 *   ELEVENLABS_API_KEY        — single key (legacy/fallback if KEYS not set)
 *   ELEVENLABS_EVA_VOICE_ID   — optional; default "Rachel" (warm female)
 *   ELEVENLABS_MODEL_ID       — optional; default "eleven_turbo_v2_5"
 *   ELEVENLABS_TIMEOUT_MS     — optional; default 30000
 *
 * Female and Male personas continue to use the browser SpeechSynthesis engine
 * client-side — only Eva routes through here.
 */

const RAW_KEYS = (process.env.ELEVENLABS_API_KEYS || process.env.ELEVENLABS_API_KEY || "").trim();
const API_KEYS: string[] = RAW_KEYS
  .split(/[,\s]+/)
  .map(s => s.trim())
  .filter(s => s.length > 0);

const DEFAULT_VOICE_ID = (process.env.ELEVENLABS_EVA_VOICE_ID || "21m00Tcm4TlvDq8ikWAM").trim(); // Rachel
const MODEL_ID = (process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5").trim();
const TIMEOUT_MS = Math.max(2000, Number(process.env.ELEVENLABS_TIMEOUT_MS || 30000));
const BASE_URL = "https://api.elevenlabs.io/v1";
const COOLDOWN_MS = 60 * 60 * 1000; // exhausted keys retry after 1 hour

export type EvaVoice = "Female" | "Male" | "Eva";

export interface ElevenLabsTtsRequest {
  text: string;
  voice: EvaVoice;
  speed?: number;
  language?: string;
}

export interface ElevenLabsTtsResult {
  ok: boolean;
  status: number;
  contentType: string;
  body?: ArrayBuffer;
  error?: string;
}

// Round-robin pointer + per-key cooldown bookkeeping.
let nextKeyIndex = 0;
const cooldownUntil = new Map<string, number>(); // key → timestamp until usable again

export const isElevenLabsConfigured = (): boolean => API_KEYS.length > 0;

/** Number of keys currently pooled (for diagnostics / health). */
export const elevenLabsKeyCount = (): number => API_KEYS.length;

/** Number of keys currently in cooldown (exhausted/rejected). */
export const elevenLabsExhaustedCount = (): number => {
  const now = Date.now();
  let count = 0;
  for (const ts of cooldownUntil.values()) if (ts > now) count++;
  return count;
};

function isUsable(key: string, now: number): boolean {
  const until = cooldownUntil.get(key);
  return !until || until <= now;
}

/** Pick the next usable key in round-robin order. Returns null if pool empty. */
function pickKey(): string | null {
  if (API_KEYS.length === 0) return null;
  const now = Date.now();
  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const key = API_KEYS[nextKeyIndex % API_KEYS.length];
    nextKeyIndex++;
    if (isUsable(key, now)) return key;
  }
  // All exhausted — return any (so caller still surfaces a real error
  // rather than silently failing). Caller will mark it exhausted again.
  return API_KEYS[nextKeyIndex++ % API_KEYS.length];
}

function markExhausted(key: string, reason: string) {
  cooldownUntil.set(key, Date.now() + COOLDOWN_MS);
  console.warn(`[ElevenLabs] Key ${maskKey(key)} cooled down for 1h: ${reason}`);
}

function maskKey(key: string): string {
  if (key.length <= 10) return "***";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function resolveVoiceId(voice: EvaVoice): string {
  switch (voice) {
    case "Eva":
    case "Female":
      return DEFAULT_VOICE_ID;
    case "Male":
      return process.env.ELEVENLABS_MALE_VOICE_ID?.trim() || "pNInz6obpgDQGcFmaJgB"; // Adam
  }
}

/**
 * Synthesize one sentence. On per-key errors that indicate the key itself is
 * the problem (401 invalid, 402 out of credits, 429 rate-limited), the helper
 * automatically rotates to the next usable key and retries — up to the size
 * of the pool. The caller only sees the final outcome.
 */
export async function elevenLabsSynthesize(req: ElevenLabsTtsRequest): Promise<ElevenLabsTtsResult> {
  if (!isElevenLabsConfigured()) {
    return { ok: false, status: 501, contentType: "", error: "no ElevenLabs API keys configured" };
  }

  const text = (req.text || "").trim();
  if (!text) return { ok: false, status: 400, contentType: "", error: "empty text" };

  const safeText = text.length > 1000 ? text.slice(0, 1000) : text;
  const voiceId = resolveVoiceId(req.voice);

  const payload: Record<string, unknown> = {
    text: safeText,
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.40,
      similarity_boost: 0.75,
      style: 0.35,
      use_speaker_boost: true,
    },
  };
  if (req.language && req.language.length >= 2) {
    payload.language_code = req.language.slice(0, 2).toLowerCase();
  }

  // Try every key in the pool before giving up.
  let lastErr: ElevenLabsTtsResult | null = null;
  const triedKeys = new Set<string>();

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const key = pickKey();
    if (!key || triedKeys.has(key)) break;
    triedKeys.add(key);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
          "User-Agent": "Vextorn/1.0 (+ai-tutor)",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") || "audio/mpeg";

      if (res.ok) {
        const body = await res.arrayBuffer();
        return { ok: true, status: 200, contentType, body };
      }

      const errText = await res.text().catch(() => "");
      const errSnippet = errText.slice(0, 200);

      // Per-key failure — rotate. 401 invalid, 402 no credits, 403 forbidden,
      // 429 rate-limit. For these we mark the key exhausted and try the next.
      if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 429) {
        markExhausted(key, `HTTP ${res.status}`);
        lastErr = {
          ok: false,
          status: res.status,
          contentType,
          error: `ElevenLabs ${res.status}: ${errSnippet}`,
        };
        continue; // try next key
      }

      // Non-key-related error (e.g. 400 bad request) — no point retrying.
      return {
        ok: false,
        status: res.status,
        contentType,
        error: `ElevenLabs ${res.status}: ${errSnippet}`,
      };
    } catch (err: any) {
      const aborted = err?.name === "AbortError";
      lastErr = {
        ok: false,
        status: aborted ? 504 : 502,
        contentType: "",
        error: aborted ? "ElevenLabs request timed out" : `ElevenLabs fetch failed: ${err?.message || err}`,
      };
      // Network error — try next key in case this one's region is down.
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  return lastErr || {
    ok: false,
    status: 502,
    contentType: "",
    error: "all ElevenLabs keys exhausted or failed",
  };
}

/**
 * Health check — verifies at least one key in the pool is usable.
 * Pings /user/subscription with the next-up key (cheap, doesn't burn quota).
 */
export async function elevenLabsHealth(): Promise<{
  available: boolean;
  reachable: boolean;
  keyCount: number;
  exhausted: number;
}> {
  const keyCount = API_KEYS.length;
  const exhausted = elevenLabsExhaustedCount();

  if (keyCount === 0) {
    return { available: false, reachable: false, keyCount: 0, exhausted: 0 };
  }

  const key = pickKey();
  if (!key) return { available: true, reachable: false, keyCount, exhausted };

  // Use /voices (TTS-scoped keys can read voices). Avoid /user/subscription
  // because TTS-only keys reject it with a missing-permission error even
  // though the key itself is perfectly valid for TTS calls.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${BASE_URL}/voices?show_legacy=false&page_size=1`, {
      method: "GET",
      headers: { "xi-api-key": key, "User-Agent": "Vextorn/1.0 (+health)" },
      signal: controller.signal,
    });
    // 200 = perfect. 401/403 = key invalid. Anything else (incl. permission
    // errors on non-essential scopes) we still treat as "key probably works
    // for TTS" — only TTS itself is the source of truth.
    const reachable = res.ok || (res.status !== 401 && res.status !== 403);
    return { available: true, reachable, keyCount, exhausted };
  } catch {
    return { available: true, reachable: false, keyCount, exhausted };
  } finally {
    clearTimeout(timeout);
  }
}
