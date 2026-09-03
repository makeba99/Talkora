/**
 * Free Microsoft Edge neural TTS (no API key).
 * Uses the same online voices Edge Read Aloud uses — natural, conversational.
 */

import { EdgeTTS } from "edge-tts-universal";

const TIMEOUT_MS = 30_000;

export const EDGE_FEMALE_DEFAULT = "en-US-AvaNeural";
export const EDGE_MALE_DEFAULT = "en-US-AndrewNeural";

/** Curated natural English voices for the AI Tutor admin picker. */
export const EDGE_VOICE_OPTIONS = [
  { value: "en-US-AvaNeural", label: "Ava (US female — recommended)", gender: "female" as const },
  { value: "en-US-EmmaMultilingualNeural", label: "Emma Multilingual (US female)", gender: "female" as const },
  { value: "en-US-JennyNeural", label: "Jenny (US female)", gender: "female" as const },
  { value: "en-GB-SoniaNeural", label: "Sonia (UK female)", gender: "female" as const },
  { value: "en-US-AndrewNeural", label: "Andrew (US male — recommended)", gender: "male" as const },
  { value: "en-US-BrianMultilingualNeural", label: "Brian Multilingual (US male)", gender: "male" as const },
  { value: "en-US-GuyNeural", label: "Guy (US male)", gender: "male" as const },
  { value: "en-GB-RyanNeural", label: "Ryan (UK male)", gender: "male" as const },
];

export interface EdgeTtsResult {
  ok: boolean;
  status: number;
  contentType: string;
  body?: ArrayBuffer;
  error?: string;
}

/** Map OpenAI-style short names (or empty) onto Edge neural voices. */
export function resolveEdgeVoiceId(voice: string | null | undefined, gender: "female" | "male"): string {
  const v = String(voice || "").trim();
  if (/Neural$/i.test(v)) return v;
  // Legacy OpenAI names → Edge equivalents
  if (/^(nova|shimmer|alloy|fable|coral|sage)$/i.test(v)) return EDGE_FEMALE_DEFAULT;
  if (/^(onyx|echo|ash)$/i.test(v)) return EDGE_MALE_DEFAULT;
  return gender === "male" ? EDGE_MALE_DEFAULT : EDGE_FEMALE_DEFAULT;
}

export async function edgeSynthesize(
  text: string,
  voice: string,
  rate = "+0%",
): Promise<EdgeTtsResult> {
  const trimmed = text.trim().slice(0, 4096);
  if (!trimmed) return { ok: false, status: 400, contentType: "", error: "empty text" };

  try {
    const tts = new EdgeTTS(trimmed, voice || EDGE_FEMALE_DEFAULT, {
      rate,
      volume: "+0%",
      pitch: "+0Hz",
    });

    const result = await Promise.race([
      tts.synthesize(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Edge TTS timed out")), TIMEOUT_MS),
      ),
    ]);

    const audio = result?.audio;
    if (!audio) {
      return { ok: false, status: 502, contentType: "", error: "Edge TTS returned no audio" };
    }

    const body =
      typeof (audio as Blob).arrayBuffer === "function"
        ? await (audio as Blob).arrayBuffer()
        : (audio as ArrayBuffer);

    if (!body || (body as ArrayBuffer).byteLength < 32) {
      return { ok: false, status: 502, contentType: "", error: "Edge TTS empty audio" };
    }

    return { ok: true, status: 200, contentType: "audio/mpeg", body };
  } catch (err: any) {
    const msg = String(err?.message || err || "Edge TTS failed").slice(0, 200);
    console.warn("[edge-tts]", msg);
    return { ok: false, status: 502, contentType: "", error: msg };
  }
}

export async function edgeTtsHealth(): Promise<{ available: boolean; reachable: boolean }> {
  try {
    const r = await edgeSynthesize("Hi.", EDGE_FEMALE_DEFAULT);
    return { available: true, reachable: r.ok };
  } catch {
    return { available: true, reachable: false };
  }
}
