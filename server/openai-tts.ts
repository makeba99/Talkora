/**
 * OpenAI TTS proxy — used as a high-quality fallback for the AI Tutor voice
 * when Sesame CSM (Modal) isn't reachable. The client TTS engine is
 * provider-agnostic — it just plays the audio bytes this endpoint returns.
 *
 * Voice mapping (Vextorn persona → OpenAI voice id):
 *   Female  → "nova"  (a.k.a. "Eva" — bright, young, conversational)
 *   Male    → "onyx"  (warm, grounded male)
 *
 * Returns audio/mpeg (mp3) which Web Audio decodes natively in every modern
 * browser, so no client changes are needed.
 */

import type { SesameTtsRequest, SesameTtsResult } from "./sesame";

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
const OPENAI_TTS_MODEL = (process.env.OPENAI_TTS_MODEL || "tts-1").trim() || "tts-1";
const OPENAI_TTS_TIMEOUT_MS = Math.max(2000, Number(process.env.OPENAI_TTS_TIMEOUT_MS || 20000));

export const isOpenAiTtsConfigured = (): boolean => OPENAI_API_KEY.length > 0;

const VOICE_MAP: Record<"Female" | "Male", string> = {
  Female: "nova",
  Male: "onyx",
};

export async function openaiTtsSynthesize(req: SesameTtsRequest): Promise<SesameTtsResult> {
  if (!isOpenAiTtsConfigured()) {
    return { ok: false, status: 501, contentType: "", error: "OPENAI_API_KEY not configured" };
  }

  const text = (req.text || "").trim();
  if (!text) return { ok: false, status: 400, contentType: "", error: "empty text" };

  const safeText = text.length > 600 ? text.slice(0, 600) : text;
  const voice = VOICE_MAP[req.voice] || "nova";
  const speed = typeof req.speed === "number" ? Math.max(0.5, Math.min(2, req.speed)) : 1.0;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TTS_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
        "User-Agent": "Vextorn/1.0 (+ai-tutor-openai-tts)",
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        input: safeText,
        voice,
        response_format: "mp3",
        speed,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        contentType: res.headers.get("content-type") || "",
        error: `OpenAI TTS ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const body = await res.arrayBuffer();
    return {
      ok: true,
      status: 200,
      contentType: res.headers.get("content-type") || "audio/mpeg",
      body,
    };
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      contentType: "",
      error: aborted ? "OpenAI TTS request timed out" : `OpenAI TTS fetch failed: ${err?.message || err}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface VoiceTtsHealth {
  available: boolean;
  reachable: boolean;
}

/** Lightweight check — OpenAI TTS doesn't have a free probe endpoint, so we
 *  just report `available` based on whether the key is set. */
export function openaiTtsHealth(): VoiceTtsHealth {
  return { available: isOpenAiTtsConfigured(), reachable: isOpenAiTtsConfigured() };
}
