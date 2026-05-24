/**
 * Hugging Face Inference API TTS provider for the AI Tutor.
 * Sends text to any TTS model hosted on HF Inference API.
 *
 * Popular free TTS models:
 *   facebook/mms-tts-eng   – Facebook MMS multilingual (English)
 *   espnet/kan-bayashi_ljspeech_vits – LJSpeech VITS
 *   microsoft/speecht5_tts – SpeechT5
 */

const TIMEOUT_MS = 45_000;

export interface HuggingFaceTtsResult {
  ok: boolean;
  status: number;
  contentType: string;
  body?: ArrayBuffer;
  error?: string;
}

export async function huggingFaceSynthesize(
  text: string,
  model: string,
  apiKey: string,
): Promise<HuggingFaceTtsResult> {
  if (!apiKey) {
    return { ok: false, status: 501, contentType: "", error: "no Hugging Face API key configured" };
  }
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, status: 400, contentType: "", error: "empty text" };

  const endpoint = `https://api-inference.huggingface.co/models/${model || "facebook/mms-tts-eng"}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Vextorn/1.0 (+ai-tutor)",
      },
      body: JSON.stringify({ inputs: trimmed.slice(0, 1000) }),
      signal: controller.signal,
    });

    if (res.ok) {
      const body = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "audio/flac";
      return { ok: true, status: 200, contentType, body };
    }

    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      contentType: "",
      error: `HuggingFace ${res.status}: ${errText.slice(0, 200)}`,
    };
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      contentType: "",
      error: aborted
        ? "Hugging Face request timed out"
        : `Hugging Face fetch failed: ${err?.message || err}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function huggingFaceTtsHealth(
  apiKey: string,
): Promise<{ available: boolean; reachable: boolean }> {
  if (!apiKey) return { available: false, reachable: false };
  return { available: true, reachable: true };
}
