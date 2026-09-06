/**
 * Cloud speech-to-text for the AI tutor.
 *
 * The browser Web Speech API opens a *second* microphone capture of its own.
 * Inside a voice room the mic is already held by the WebRTC stream, and many
 * platforms (mobile Chrome especially) hand that second capture nothing but
 * silence — recognition starts, reports "listening", and never returns a
 * single word. Transcribing the room's existing audio here sidesteps the
 * contention completely, and covers browsers with no Web Speech API at all.
 *
 * Keys are shared with the AI brain: a Groq key transcribes through Whisper
 * turbo, an OpenAI key through gpt-4o-mini-transcribe.
 */
import {
  getAiTutorConfig,
  isGroqKey,
  sanitizeKey,
  GROQ_BASE_URL,
  OPENAI_BASE_URL,
} from "./ai-config";

export type SttProvider = "groq" | "openai";

export interface SttCandidate {
  key: string;
  provider: SttProvider;
  model: string;
  baseUrl: string;
}

const GROQ_STT_MODEL = "whisper-large-v3-turbo";
const OPENAI_STT_MODEL = "gpt-4o-mini-transcribe";

/** Largest audio payload we forward to a provider (~30 s of 16 kHz mono WAV). */
export const MAX_STT_BYTES = 1_400_000;

function candidateFor(key: string): SttCandidate | null {
  const clean = sanitizeKey(key);
  if (!clean) return null;
  const provider: SttProvider = isGroqKey(clean) ? "groq" : "openai";
  const envProvider = (process.env.AI_STT_PROVIDER || "").trim().toLowerCase();
  const resolved: SttProvider =
    envProvider === "groq" || envProvider === "openai" ? (envProvider as SttProvider) : provider;
  const envModel = (process.env.AI_STT_MODEL || "").trim();
  const envBaseUrl = (process.env.AI_STT_BASE_URL || "").trim();
  return {
    key: clean,
    provider: resolved,
    model: envModel || (resolved === "groq" ? GROQ_STT_MODEL : OPENAI_STT_MODEL),
    baseUrl: envBaseUrl || (resolved === "groq" ? GROQ_BASE_URL : OPENAI_BASE_URL),
  };
}

/**
 * Keys that can transcribe, best first. Groq is preferred when both are
 * available: Whisper turbo is both cheaper and faster than the OpenAI models.
 */
export async function resolveSttCandidates(): Promise<SttCandidate[]> {
  const explicit = candidateFor(process.env.AI_STT_KEY || "");
  if (explicit) return [explicit];

  let brainKeys: string[] = [];
  try {
    const cfg = await getAiTutorConfig();
    brainKeys = [cfg.brain.primaryKey, cfg.brain.secondaryKey];
  } catch {
    brainKeys = [];
  }

  const candidates = brainKeys
    .map(candidateFor)
    .filter((c): c is SttCandidate => !!c);

  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });

  // Groq first — Whisper turbo is the cheapest and fastest option we have.
  return unique.sort((a, b) => (a.provider === "groq" ? -1 : 0) - (b.provider === "groq" ? -1 : 0));
}

export async function sttAvailable(): Promise<{ available: boolean; provider: SttProvider | null }> {
  const candidates = await resolveSttCandidates();
  return { available: candidates.length > 0, provider: candidates[0]?.provider ?? null };
}

export interface TranscribeResult {
  ok: boolean;
  text?: string;
  provider?: SttProvider;
  model?: string;
  status?: number;
  error?: string;
}

function extensionFor(mimeType: string): string {
  if (/webm/i.test(mimeType)) return "webm";
  if (/ogg|opus/i.test(mimeType)) return "ogg";
  if (/mp4|m4a|aac/i.test(mimeType)) return "mp4";
  if (/mpeg|mp3/i.test(mimeType)) return "mp3";
  return "wav";
}

async function callProvider(
  candidate: SttCandidate,
  audio: Buffer,
  mimeType: string,
  language: string | null,
): Promise<TranscribeResult> {
  const form = new FormData();
  const ext = extensionFor(mimeType);
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `speech.${ext}`);
  form.append("model", candidate.model);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (language) form.append("language", language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${candidate.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${candidate.key}` },
      body: form,
      signal: controller.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      let detail = raw.slice(0, 300);
      try {
        detail = JSON.parse(raw)?.error?.message || detail;
      } catch {
        /* keep the raw snippet */
      }
      return { ok: false, status: res.status, error: detail, provider: candidate.provider };
    }
    let text = "";
    try {
      text = String(JSON.parse(raw)?.text ?? "").trim();
    } catch {
      text = raw.trim();
    }
    return { ok: true, text, provider: candidate.provider, model: candidate.model };
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      error: aborted ? "transcription timed out" : err?.message || "transcription failed",
      provider: candidate.provider,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Retryable provider failures — fall through to the next configured key. */
function shouldFailover(status?: number): boolean {
  if (!status) return true;
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

export async function transcribeSpeech(
  audio: Buffer,
  mimeType: string,
  language: string | null,
): Promise<TranscribeResult> {
  const candidates = await resolveSttCandidates();
  if (candidates.length === 0) {
    return { ok: false, status: 501, error: "no-stt-key" };
  }

  let last: TranscribeResult = { ok: false, status: 502, error: "transcription failed" };
  for (const candidate of candidates) {
    last = await callProvider(candidate, audio, mimeType, language);
    if (last.ok) return last;
    if (!shouldFailover(last.status)) return last;
  }
  return last;
}
