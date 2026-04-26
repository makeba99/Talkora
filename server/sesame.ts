/**
 * Sesame CSM proxy — bridges Vextorn's AI Tutor to a self-hosted Sesame
 * Conversational Speech Model (CSM) inference server.
 *
 * CSM weights are gated and the model needs a GPU, so Vextorn never runs CSM
 * itself — it calls a separate inference server you deploy (Modal, RunPod,
 * HF Endpoints, your own GPU box). See `csm-server/README.md` for the
 * reference FastAPI server we ship for that.
 *
 * Env:
 *   SESAME_CSM_URL    — base URL of your CSM inference server (e.g. https://csm.your-domain.com)
 *   SESAME_CSM_TOKEN  — optional bearer token sent as `Authorization: Bearer <token>`
 *   SESAME_CSM_TIMEOUT_MS — optional request timeout (default 25000)
 *
 * If SESAME_CSM_URL is not set, the proxy reports unavailable and the client
 * automatically falls back to the existing browser SpeechSynthesis path —
 * no regression, no errors surfaced to the user.
 */

const CSM_URL = (process.env.SESAME_CSM_URL || "").trim().replace(/\/+$/, "");
const CSM_TOKEN = (process.env.SESAME_CSM_TOKEN || "").trim();
const CSM_TIMEOUT_MS = Math.max(2000, Number(process.env.SESAME_CSM_TIMEOUT_MS || 25000));

export const isSesameConfigured = (): boolean => CSM_URL.length > 0;

export type SesameVoice = "Female" | "Male" | "Eva";

export interface SesameTtsRequest {
  text: string;
  voice: SesameVoice;
  speed?: number;          // 0.5..2.0 — server may or may not honor
  language?: string;       // BCP-47 hint
}

export interface SesameTtsResult {
  ok: boolean;
  status: number;
  contentType: string;     // e.g. "audio/wav" or "audio/mpeg"
  body?: ArrayBuffer;
  error?: string;
}

/**
 * Maps Vextorn's persona names to CSM speaker IDs.
 * The reference CSM server uses int speaker IDs (0..N). Override per
 * deployment by editing this map (or by extending the server to accept
 * symbolic names directly).
 */
const VOICE_TO_SPEAKER: Record<SesameVoice, number> = {
  Female: 0,
  Male: 1,
  // Eva uses the same Sesame female speaker tone as Female (speaker 0); the
  // distinction here is only that Eva is *always* routed through Sesame —
  // Female stays on the browser engine.
  Eva: 0,
};

export async function sesameSynthesize(req: SesameTtsRequest): Promise<SesameTtsResult> {
  if (!isSesameConfigured()) {
    return { ok: false, status: 501, contentType: "", error: "SESAME_CSM_URL not configured" };
  }

  const text = (req.text || "").trim();
  if (!text) {
    return { ok: false, status: 400, contentType: "", error: "empty text" };
  }
  // Hard cap to keep latency + GPU time bounded per request.
  const safeText = text.length > 600 ? text.slice(0, 600) : text;

  const speaker = VOICE_TO_SPEAKER[req.voice] ?? 0;

  const payload = {
    text: safeText,
    speaker,
    voice: req.voice,
    speed: typeof req.speed === "number" ? Math.max(0.5, Math.min(2, req.speed)) : 1.0,
    language: req.language || "en",
    // CSM caps at ~10s per generation; ask server to clamp.
    max_audio_length_ms: 10000,
    format: "wav",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CSM_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "audio/wav, audio/mpeg, application/octet-stream",
      "User-Agent": "Vextorn/1.0 (+ai-tutor)",
    };
    if (CSM_TOKEN) headers["Authorization"] = `Bearer ${CSM_TOKEN}`;

    const res = await fetch(`${CSM_URL}/v1/tts`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "application/octet-stream";

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        contentType,
        error: `CSM ${res.status}: ${errText.slice(0, 200)}`,
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
      error: aborted ? "CSM request timed out" : `CSM fetch failed: ${err?.message || err}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Lightweight ping to the upstream so the client can decide whether to use
 * Sesame at all. We do NOT call /v1/tts (expensive) — just a HEAD/GET on the
 * server's /healthz endpoint with a short timeout. If that fails, we still
 * return ok=true if the URL is configured (the client will gracefully fall
 * back per-request anyway), so a flapping server doesn't disable CSM forever.
 */
export async function sesameHealth(): Promise<{ available: boolean; reachable: boolean; url: string | null }> {
  if (!isSesameConfigured()) return { available: false, reachable: false, url: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const headers: Record<string, string> = { "User-Agent": "Vextorn/1.0 (+health)" };
    if (CSM_TOKEN) headers["Authorization"] = `Bearer ${CSM_TOKEN}`;
    const res = await fetch(`${CSM_URL}/healthz`, { method: "GET", headers, signal: controller.signal });
    return { available: true, reachable: res.ok, url: CSM_URL };
  } catch {
    return { available: true, reachable: false, url: CSM_URL };
  } finally {
    clearTimeout(timeout);
  }
}
