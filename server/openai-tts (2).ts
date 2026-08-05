/**
 * OpenAI TTS provider for the AI Tutor.
 * Uses the /v1/audio/speech endpoint with configurable model + voice.
 */

const TIMEOUT_MS = 30_000;

export interface OpenAiTtsResult {
  ok: boolean;
  status: number;
  contentType: string;
  body?: ArrayBuffer;
  error?: string;
}

export async function openAiSynthesize(
  text: string,
  voice: string,
  model: string,
  apiKey: string,
): Promise<OpenAiTtsResult> {
  if (!apiKey) {
    return { ok: false, status: 501, contentType: "", error: "no OpenAI API key configured" };
  }
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, status: 400, contentType: "", error: "empty text" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Vextorn/1.0 (+ai-tutor)",
      },
      body: JSON.stringify({
        model: model || "tts-1",
        input: trimmed.slice(0, 4096),
        voice: voice || "nova",
        response_format: "mp3",
      }),
      signal: controller.signal,
    });

    if (res.ok) {
      const body = await res.arrayBuffer();
      return { ok: true, status: 200, contentType: "audio/mpeg", body };
    }

    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      contentType: "",
      error: `OpenAI ${res.status}: ${errText.slice(0, 200)}`,
    };
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      contentType: "",
      error: aborted ? "OpenAI request timed out" : `OpenAI fetch failed: ${err?.message || err}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function openAiTtsHealth(
  apiKey: string,
): Promise<{ available: boolean; reachable: boolean }> {
  if (!apiKey) return { available: false, reachable: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}`, "User-Agent": "Vextorn/1.0 (+health)" },
      signal: controller.signal,
    });
    return { available: true, reachable: res.ok || res.status === 401 };
  } catch {
    return { available: true, reachable: false };
  } finally {
    clearTimeout(timeout);
  }
}
