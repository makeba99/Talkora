/**
 * ElevenLabs TTS proxy — used to power the AI Tutor "Eva" persona.
 *
 * Why ElevenLabs and not Sesame: Sesame CSM requires self-hosting on a GPU
 * (Modal/RunPod/etc) and was operationally fragile. ElevenLabs is a hosted
 * API — paste a key, it works — with arguably better voice quality.
 *
 * Env:
 *   ELEVENLABS_API_KEY        — required; create at https://elevenlabs.io/app/settings/api-keys
 *   ELEVENLABS_EVA_VOICE_ID   — optional; default is "Rachel" (warm conversational female)
 *   ELEVENLABS_MODEL_ID       — optional; default "eleven_turbo_v2_5" (low latency, multilingual)
 *   ELEVENLABS_TIMEOUT_MS     — optional; default 30000
 *
 * Female and Male personas continue to use the browser SpeechSynthesis engine
 * client-side — only Eva routes through here.
 */

const API_KEY = (process.env.ELEVENLABS_API_KEY || "").trim();
const DEFAULT_VOICE_ID = (process.env.ELEVENLABS_EVA_VOICE_ID || "21m00Tcm4TlvDq8ikWAM").trim(); // Rachel
const MODEL_ID = (process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5").trim();
const TIMEOUT_MS = Math.max(2000, Number(process.env.ELEVENLABS_TIMEOUT_MS || 30000));
const BASE_URL = "https://api.elevenlabs.io/v1";

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

export const isElevenLabsConfigured = (): boolean => API_KEY.length > 0;

/**
 * Voice routing per persona. Only Eva is meant to hit ElevenLabs in normal
 * operation, but Female/Male are mapped too in case the route is ever called
 * directly (e.g. for a future server-rendered preview).
 */
function resolveVoiceId(voice: EvaVoice): string {
  switch (voice) {
    case "Eva":
      return DEFAULT_VOICE_ID;
    case "Female":
      return DEFAULT_VOICE_ID;
    case "Male":
      // "Adam" — neutral male voice
      return process.env.ELEVENLABS_MALE_VOICE_ID?.trim() || "pNInz6obpgDQGcFmaJgB";
  }
}

export async function elevenLabsSynthesize(req: ElevenLabsTtsRequest): Promise<ElevenLabsTtsResult> {
  if (!isElevenLabsConfigured()) {
    return { ok: false, status: 501, contentType: "", error: "ELEVENLABS_API_KEY not configured" };
  }

  const text = (req.text || "").trim();
  if (!text) {
    return { ok: false, status: 400, contentType: "", error: "empty text" };
  }
  // Hard cap to keep latency + cost bounded per request.
  const safeText = text.length > 1000 ? text.slice(0, 1000) : text;
  const voiceId = resolveVoiceId(req.voice);

  // Voice settings — slightly more expressive than ElevenLabs defaults so
  // Eva sounds animated rather than monotone.
  const payload: Record<string, unknown> = {
    text: safeText,
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.40,         // lower = more expressive
      similarity_boost: 0.75,  // keeps the chosen voice's timbre
      style: 0.35,             // adds emotional variation (multilingual_v2/turbo_v2_5)
      use_speaker_boost: true,
    },
  };

  // ElevenLabs uses ISO 639-1 language codes for the multilingual models.
  if (req.language && req.language.length >= 2) {
    payload.language_code = req.language.slice(0, 2).toLowerCase();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
        "User-Agent": "Vextorn/1.0 (+ai-tutor)",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "audio/mpeg";

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        contentType,
        error: `ElevenLabs ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const body = await res.arrayBuffer();
    return { ok: true, status: 200, contentType, body };
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      contentType: "",
      error: aborted ? "ElevenLabs request timed out" : `ElevenLabs fetch failed: ${err?.message || err}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Health check — verifies API key is set and ElevenLabs reports our user is
 * valid. Used by /api/ai-tutor/tts/health so the client can surface a status
 * indicator without spending TTS quota.
 */
export async function elevenLabsHealth(): Promise<{ available: boolean; reachable: boolean }> {
  if (!isElevenLabsConfigured()) return { available: false, reachable: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${BASE_URL}/user/subscription`, {
      method: "GET",
      headers: { "xi-api-key": API_KEY, "User-Agent": "Vextorn/1.0 (+health)" },
      signal: controller.signal,
    });
    return { available: true, reachable: res.ok };
  } catch {
    return { available: true, reachable: false };
  } finally {
    clearTimeout(timeout);
  }
}
