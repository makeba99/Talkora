import {
  isSesameSpeakerId,
  resolveTalkingPartner,
  type SesameSpeakerId,
} from "@shared/talking-partners";
import { SESAME_INFER_API } from "./types";

export const DEFAULT_SESAME_SPACE = "sesame/csm-1b";
export const DEFAULT_SPEAKER_A: SesameSpeakerId = "conversational_a";
export const DEFAULT_SPEAKER_B: SesameSpeakerId = "conversational_b";

const MAX_UTTERANCE_CHARS = 480;

export type SesameInferPayload = {
  api_name: typeof SESAME_INFER_API;
  text_prompt_speaker_a: string;
  text_prompt_speaker_b: string;
  audio_prompt_speaker_a: unknown;
  audio_prompt_speaker_b: unknown;
  gen_conversation_input: string;
};

export function resolveSesameSpeaker(
  voiceId: string | null | undefined,
  genderHint?: string | null,
): { speakerA: SesameSpeakerId; speakerB: SesameSpeakerId } {
  if (isSesameSpeakerId(voiceId)) {
    const speakerA = voiceId;
    const speakerB = speakerA === DEFAULT_SPEAKER_A ? DEFAULT_SPEAKER_B : DEFAULT_SPEAKER_A;
    return { speakerA, speakerB };
  }
  const partner = resolveTalkingPartner({ partnerId: voiceId, voice: genderHint });
  const envMaya = process.env.AI_VOICE_SESAME_MAYA;
  const envMiles = process.env.AI_VOICE_SESAME_MILES;
  const speakerA: SesameSpeakerId = isSesameSpeakerId(partner.gender === "Male" ? envMiles : envMaya)
    ? ((partner.gender === "Male" ? envMiles : envMaya) as SesameSpeakerId)
    : partner.defaultSesameSpeaker;
  const speakerB: SesameSpeakerId =
    speakerA === DEFAULT_SPEAKER_A ? DEFAULT_SPEAKER_B : DEFAULT_SPEAKER_A;
  return { speakerA, speakerB };
}

/** Single-utterance conversation so playback is only the AI line (speaker A). */
export function conversationForAiUtterance(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_UTTERANCE_CHARS);
}

export function buildSesameInferPayload(opts: {
  textPromptA: string;
  textPromptB: string;
  audioPromptA: unknown;
  audioPromptB: unknown;
  utterance: string;
}): SesameInferPayload {
  return {
    api_name: SESAME_INFER_API,
    text_prompt_speaker_a: opts.textPromptA,
    text_prompt_speaker_b: opts.textPromptB,
    audio_prompt_speaker_a: opts.audioPromptA,
    audio_prompt_speaker_b: opts.audioPromptB,
    gen_conversation_input: conversationForAiUtterance(opts.utterance),
  };
}

export function unwrapPredictData(data: unknown): unknown {
  if (Array.isArray(data)) return data[0];
  return data;
}

export function fileUrlFromPredict(data: unknown): string | null {
  const v = unwrapPredictData(data);
  if (typeof v === "string") {
    if (/^https?:\/\//i.test(v)) return v;
    return null;
  }
  if (v && typeof v === "object") {
    const o = v as { url?: unknown; path?: unknown };
    if (typeof o.url === "string" && o.url) return o.url;
    if (typeof o.path === "string" && /^https?:\/\//i.test(o.path)) return o.path;
  }
  return null;
}

export function sesameSpaceId(): string {
  return (process.env.AI_VOICE_SESAME_SPACE || DEFAULT_SESAME_SPACE).trim() || DEFAULT_SESAME_SPACE;
}

export function sanitizeHfToken(raw: string | undefined | null): string {
  let token = String(raw || "").trim();
  if (!token) return "";
  token = token.replace(/^Bearer\s+/i, "").trim();
  token = token.replace(/^["']+|["']+$/g, "").trim();
  return token;
}

export function sesameHfToken(): string {
  return sanitizeHfToken(
    process.env.HF_TOKEN ||
      process.env.AI_VOICE_HF_TOKEN ||
      process.env.HUGGINGFACE_TOKEN ||
      process.env.HUGGING_FACE_HUB_TOKEN ||
      process.env.HUGGINGFACEHUB_API_TOKEN,
  );
}

export function sesameErrorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as Record<string, unknown>;
  return [e.message, e.title, e.original_msg, e.detail, e.error]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");
}

export function classifySesameError(err: unknown): { code: string; status: number } {
  const text = sesameErrorText(err);
  if (/401|unauthorized|invalid token|invalid credentials|InvalidRepoToken/i.test(text)) {
    return { code: "sesame-unauthorized", status: 401 };
  }
  if (/gated|agree and access|must accept|access to this model|user is not authorized/i.test(text)) {
    return { code: "sesame-gated", status: 403 };
  }
  if (/402|payment required|insufficient credits|no credits|quota.*inference/i.test(text)) {
    return { code: "sesame-credits", status: 402 };
  }
  if (
    /gpu duration|zerogpu|illegal duration|maximum allowed|gpu quota|quota exceeded/i.test(
      text,
    )
  ) {
    return { code: "sesame-gpu-quota", status: 503 };
  }
  if (/abort|timeout|timed out/i.test(text)) {
    return { code: "sesame-timeout", status: 504 };
  }
  return { code: "sesame-failed", status: 502 };
}

export function sesameSpaceOrigin(spaceId = sesameSpaceId()): string {
  const id = (spaceId || DEFAULT_SESAME_SPACE).trim();
  if (/^https?:\/\//i.test(id)) return id.replace(/\/$/, "");
  return `https://${id.replace("/", "-").toLowerCase()}.hf.space`;
}

/** Parse Gradio `GET /gradio_api/call/{api}/{event_id}` SSE text. */
export function parseGradioCallStream(sseText: string): { data?: unknown; error?: string } {
  const blocks = String(sseText || "").split(/\n\n+/);
  let error: string | undefined;
  let data: unknown;
  for (const block of blocks) {
    const eventMatch = block.match(/^event:\s*(.+)$/m);
    const dataMatch = block.match(/^data:\s*(.*)$/m);
    const event = eventMatch?.[1]?.trim() || "";
    const raw = dataMatch?.[1] ?? "";
    if (event === "error") {
      if (!raw || raw === "null") {
        error =
          "The requested GPU duration (180s) is larger than the maximum allowed";
      } else {
        try {
          const parsed = JSON.parse(raw);
          error =
            typeof parsed === "string"
              ? parsed
              : sesameErrorText(parsed) || raw;
        } catch {
          error = raw;
        }
      }
    }
    if (event === "complete" && raw && raw !== "null") {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }
  }
  if (error && data === undefined) return { error };
  if (data !== undefined) return { data };
  return { error: error || "sesame-no-audio" };
}

export async function inferViaGradioCallApi(opts: {
  spaceId: string;
  payload: SesameInferPayload;
  token?: string;
  signal?: AbortSignal;
}): Promise<{ data: unknown }> {
  const origin = sesameSpaceOrigin(opts.spaceId);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Vextorn/1.0 (+sesame-csm)",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const start = await fetch(`${origin}/gradio_api/call/infer`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: [
        opts.payload.text_prompt_speaker_a,
        opts.payload.text_prompt_speaker_b,
        opts.payload.audio_prompt_speaker_a,
        opts.payload.audio_prompt_speaker_b,
        opts.payload.gen_conversation_input,
      ],
    }),
    signal: opts.signal,
  });
  const startedText = await start.text();
  let started: { event_id?: string; error?: string; detail?: unknown } = {};
  try {
    started = JSON.parse(startedText);
  } catch {
    throw new Error(startedText.slice(0, 300) || `infer call ${start.status}`);
  }
  if (!start.ok || !started.event_id) {
    throw new Error(
      sesameErrorText(started.detail) ||
        started.error ||
        startedText.slice(0, 300) ||
        `infer call ${start.status}`,
    );
  }

  const stream = await fetch(`${origin}/gradio_api/call/infer/${started.event_id}`, {
    headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : {},
    signal: opts.signal,
  });
  const sseText = await stream.text();
  const parsed = parseGradioCallStream(sseText);
  if (parsed.error && parsed.data === undefined) {
    throw new Error(parsed.error);
  }
  return { data: parsed.data };
}

const HF_INFERENCE_URLS = [
  "https://router.huggingface.co/hf-inference/models/sesame/csm-1b",
  "https://router.huggingface.co/hf-inference/v1/audio/speech",
  "https://api-inference.huggingface.co/models/sesame/csm-1b",
];

const FAL_RUN_URL = "https://fal.run/fal-ai/csm-1b";
const HF_FAL_ROUTER_URL = "https://router.huggingface.co/fal-ai/fal-ai/csm-1b";

const PROMPT_A_WAV =
  "https://huggingface.co/spaces/sesame/csm-1b/resolve/main/prompts/conversational_a.wav";
const PROMPT_B_WAV =
  "https://huggingface.co/spaces/sesame/csm-1b/resolve/main/prompts/conversational_b.wav";
const PROMPT_A_TEXT =
  "like revising for an exam I'd have to try and like keep up the momentum because I'd start really early I'd be like okay I'm gonna start revising now and then like you're revising for ages and then I just like start losing steam I didn't do that for the exam we had recently to be fair that was a more of a last minute scenario but like yeah I'm trying to like yeah I noticed this yesterday that like Mondays I sort of start the day with this not like a panic but like a";
const PROMPT_B_TEXT =
  "like a super Mario level. Like it's very like high detail. And like, once you get into the park, it just like, everything looks like a computer game and they have all these, like, you know, if, if there's like a, you know, like in a Mario game, they will have like a question block. And if you like, you know, punch it, a coin will come out. So like everyone, when they come into the park, they get like this little bracelet and then you can go punching question blocks around.";

export function sesameSpeakerIndex(speakerA: string): 0 | 1 {
  return /_b$|_d$/i.test(speakerA) ? 1 : 0;
}

export function sesameFalKey(): string {
  let token = sanitizeHfToken(
    process.env.FAL_KEY || process.env.AI_VOICE_FAL_KEY || process.env.FAL_API_KEY,
  );
  token = token.replace(/^Key\s+/i, "").trim();
  return token;
}

export function sesameDeepinfraKey(): string {
  return sanitizeHfToken(
    process.env.DEEPINFRA_TOKEN ||
      process.env.DEEPINFRA_API_KEY ||
      process.env.AI_VOICE_DEEPINFRA_TOKEN,
  );
}

export function sesamePresetVoice(speakerA: string): string {
  if (/^(conversational|read_speech)_[a-d]$/i.test(speakerA)) return speakerA;
  return sesameSpeakerIndex(speakerA) === 1 ? "conversational_b" : "conversational_a";
}

function isAudioContentType(value: string): boolean {
  return /audio\//i.test(value) || /octet-stream/i.test(value) || /wav|mpeg|flac|ogg/i.test(value);
}

function sniffAudioContentType(body: ArrayBuffer): string | null {
  if (body.byteLength < 12) return null;
  const bytes = new Uint8Array(body);
  const ascii = String.fromCharCode(...bytes.slice(0, 4));
  if (ascii === "RIFF") return "audio/wav";
  if (ascii === "OggS") return "audio/ogg";
  if (ascii === "fLaC") return "audio/flac";
  if (ascii === "ID3\u0003" || ascii.startsWith("ID3") || bytes[0] === 0xff) return "audio/mpeg";
  return null;
}

function decodeBase64Audio(raw: string): ArrayBuffer | null {
  const trimmed = raw.trim();
  const b64 = trimmed.includes("base64,") ? trimmed.slice(trimmed.indexOf("base64,") + 7) : trimmed;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64) || b64.replace(/\s+/g, "").length < 80) return null;
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.byteLength < 64) return null;
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch {
    return null;
  }
}

function audioFromJson(parsed: unknown): { body: ArrayBuffer; contentType: string } | null {
  if (!parsed) return null;
  const visit = (value: unknown, depth = 0): { body: ArrayBuffer; contentType: string } | null => {
    if (depth > 4 || value == null) return null;
    if (typeof value === "string") {
      if (/^https?:\/\//i.test(value) && /\.(wav|mp3|mpeg|ogg|flac)(\?|$)/i.test(value)) {
        return null;
      }
      const decoded = decodeBase64Audio(value);
      if (decoded) {
        return { body: decoded, contentType: sniffAudioContentType(decoded) || "audio/wav" };
      }
      return null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      for (const key of ["audio", "audio_url", "url", "generated_audio", "data"]) {
        if (key in o) {
          const found = visit(o[key], depth + 1);
          if (found) return found;
        }
      }
      if (typeof o.b64_json === "string") {
        const decoded = decodeBase64Audio(o.b64_json);
        if (decoded) return { body: decoded, contentType: "audio/wav" };
      }
    }
    return null;
  };
  return visit(parsed);
}

function jsonAudioUrl(parsed: unknown): string | null {
  if (!parsed) return null;
  if (typeof parsed === "string" && /^https?:\/\//i.test(parsed)) return parsed;
  if (typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const audio = o.audio;
  if (typeof audio === "string" && /^https?:\/\//i.test(audio)) return audio;
  if (audio && typeof audio === "object") {
    const url = (audio as { url?: unknown }).url;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
  }
  if (typeof o.audio_url === "string" && /^https?:\/\//i.test(o.audio_url)) return o.audio_url;
  if (typeof o.url === "string" && /^https?:\/\//i.test(o.url)) return o.url;
  if (Array.isArray(o.data)) {
    for (const item of o.data) {
      const nested = jsonAudioUrl(item);
      if (nested) return nested;
    }
  }
  return null;
}

async function bufferFromResponse(
  res: Response,
): Promise<{ body: ArrayBuffer; contentType: string } | { error: string; status: number } | { loading: string }> {
  const ctype = res.headers.get("content-type") || "";
  const rawBuf = await res.arrayBuffer();
  const sniffed = sniffAudioContentType(rawBuf);
  if (res.ok && (isAudioContentType(ctype) || sniffed) && rawBuf.byteLength >= 64) {
    return { body: rawBuf, contentType: sniffed || ctype.split(";")[0] || "audio/wav" };
  }
  const raw = Buffer.from(rawBuf).toString("utf8");
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (res.ok && parsed) {
    const embedded = audioFromJson(parsed);
    if (embedded) return embedded;
  }
  const msg =
    sesameErrorText(parsed) ||
    parsed?.error ||
    parsed?.estimated_time ||
    raw.slice(0, 280) ||
    `inference ${res.status}`;
  if (res.status === 503 || /currently loading|estimated_time/i.test(String(msg))) {
    return { loading: String(msg) };
  }
  return { error: String(msg), status: res.status || 502 };
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const DEEPINFRA_MAX_CHARS = 200;

async function audioFromProviderResponse(
  fetchImpl: typeof fetch,
  res: Response,
  rawBuf: ArrayBuffer,
  signal?: AbortSignal,
): Promise<{ body: ArrayBuffer; contentType: string } | { error: string; status: number }> {
  const sniffed = sniffAudioContentType(rawBuf);
  const ctype = res.headers.get("content-type") || "";
  if (res.ok && (sniffed || isAudioContentType(ctype)) && rawBuf.byteLength >= 64) {
    return { body: rawBuf, contentType: sniffed || ctype.split(";")[0] || "audio/wav" };
  }
  const raw = Buffer.from(rawBuf).toString("utf8");
  const json = safeJson(raw);
  const embedded = audioFromJson(json);
  if (embedded) return embedded;
  const audioUrl = jsonAudioUrl(json);
  if (audioUrl) {
    const downloaded = await downloadAudioUrl(fetchImpl, audioUrl, signal);
    if (downloaded) return downloaded;
  }
  return {
    error: sesameErrorText(json) || raw.slice(0, 280) || `inference ${res.status}`,
    status: res.status || 502,
  };
}

/**
 * Live Sesame CSM-1B via DeepInfra, the Hugging Face Inference Provider mapped
 * to sesame/csm-1b. HF_TOKEN is routed through router.huggingface.co/deepinfra.
 */
export async function inferViaDeepInfra(opts: {
  text: string;
  speakerA: string;
  hfToken?: string;
  deepinfraKey?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; body: ArrayBuffer; contentType: string } | { ok: false; error: string; status: number }> {
  const fetchImpl = opts.fetchImpl || fetch;
  const voice = sesamePresetVoice(opts.speakerA);
  const text = conversationForAiUtterance(opts.text).slice(0, DEEPINFRA_MAX_CHARS);
  const speechBody = {
    model: "sesame/csm-1b",
    input: text,
    voice,
    response_format: "wav",
  };
  const nativeBody = {
    text,
    preset_voice: voice,
    response_format: "wav",
    max_audio_length_ms: 10_000,
  };
  const attempts: Array<{ url: string; token: string; body: unknown }> = [];
  if (opts.hfToken) {
    attempts.push({
      url: "https://router.huggingface.co/deepinfra/v1/openai/audio/speech",
      token: opts.hfToken,
      body: speechBody,
    });
    attempts.push({
      url: "https://router.huggingface.co/v1/audio/speech",
      token: opts.hfToken,
      body: { ...speechBody, model: "sesame/csm-1b:deepinfra" },
    });
    attempts.push({
      url: "https://router.huggingface.co/deepinfra/v1/inference/sesame/csm-1b",
      token: opts.hfToken,
      body: nativeBody,
    });
  }
  if (opts.deepinfraKey) {
    attempts.push({
      url: "https://api.deepinfra.com/v1/inference/sesame/csm-1b",
      token: opts.deepinfraKey,
      body: nativeBody,
    });
    attempts.push({
      url: "https://api.deepinfra.com/v1/openai/audio/speech",
      token: opts.deepinfraKey,
      body: speechBody,
    });
    attempts.push({
      url: "https://api.deepinfra.com/v1/audio/speech",
      token: opts.deepinfraKey,
      body: speechBody,
    });
  }
  let lastError = "DeepInfra CSM unavailable";
  let lastStatus = 502;
  for (const attempt of attempts) {
    try {
      const res = await fetchImpl(attempt.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${attempt.token}`,
          "Content-Type": "application/json",
          Accept: "audio/wav, audio/mpeg, application/json",
        },
        body: JSON.stringify(attempt.body),
        signal: opts.signal,
      });
      const rawBuf = await res.arrayBuffer();
      const parsed = await audioFromProviderResponse(fetchImpl, res, rawBuf, opts.signal);
      if ("body" in parsed) {
        return { ok: true, body: parsed.body, contentType: parsed.contentType };
      }
      lastError = parsed.error;
      lastStatus = parsed.status;
      if (res.status === 401 || res.status === 403) continue;
    } catch (err: any) {
      lastError = err?.message || "DeepInfra network error";
      lastStatus = 502;
    }
  }
  return { ok: false, error: lastError, status: lastStatus };
}

/** Direct Sesame CSM-1B via Hugging Face Inference (no ZeroGPU Space / 180s cap). */
export async function inferViaHfInference(opts: {
  text: string;
  speakerA: string;
  token: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
}): Promise<{ ok: true; body: ArrayBuffer; contentType: string } | { ok: false; error: string; status: number }> {
  const fetchImpl = opts.fetchImpl || fetch;
  const speakerId = sesameSpeakerIndex(opts.speakerA);
  const tagged = `[${speakerId}]${opts.text}`;
  const payloads: Array<{ url?: string; body: unknown }> = [
    { body: { inputs: tagged } },
    { body: { inputs: opts.text } },
    {
      url: "https://router.huggingface.co/hf-inference/v1/audio/speech",
      body: { model: "sesame/csm-1b", input: tagged, voice: speakerId === 1 ? "onyx" : "alloy" },
    },
  ];
  let lastError = "HF inference unavailable";
  let lastStatus = 502;
  for (const url of HF_INFERENCE_URLS) {
    for (const payload of payloads) {
      if (payload.url && payload.url !== url) continue;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetchImpl(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${opts.token}`,
              "Content-Type": "application/json",
              Accept: "audio/wav, audio/mpeg, audio/flac, application/json",
              "x-wait-for-model": "true",
            },
            body: JSON.stringify(payload.body),
            signal: opts.signal,
          });
          const parsed = await bufferFromResponse(res);
          if ("body" in parsed) {
            return { ok: true, body: parsed.body, contentType: parsed.contentType };
          }
          if ("loading" in parsed) {
            lastError = parsed.loading;
            lastStatus = 503;
            await sleep(opts.retryDelayMs ?? 2500);
            continue;
          }
          lastError = parsed.error;
          lastStatus = parsed.status;
          if (res.status === 401 || res.status === 403) {
            return { ok: false, error: lastError, status: res.status };
          }
          break;
        } catch (err: any) {
          lastError = err?.message || "HF inference network error";
          lastStatus = 502;
          break;
        }
      }
    }
  }
  return { ok: false, error: lastError, status: lastStatus };
}

function falContextForSpeaker(_speakerId: 0 | 1) {
  return [
    { speaker_id: 0, audio_url: PROMPT_A_WAV, prompt: PROMPT_A_TEXT },
    { speaker_id: 1, audio_url: PROMPT_B_WAV, prompt: PROMPT_B_TEXT },
  ];
}

async function downloadAudioUrl(
  fetchImpl: typeof fetch,
  url: string,
  signal?: AbortSignal,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const file = await fetchImpl(url, { signal });
  const downloaded = await bufferFromResponse(file);
  return "body" in downloaded ? downloaded : null;
}

/** Hosted Sesame CSM-1B on fal.ai (real GPU, not ZeroGPU). */
export async function inferViaFal(opts: {
  text: string;
  speakerA: string;
  falKey?: string;
  hfToken?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; body: ArrayBuffer; contentType: string } | { ok: false; error: string; status: number }> {
  const fetchImpl = opts.fetchImpl || fetch;
  const speakerId = sesameSpeakerIndex(opts.speakerA);
  const body = JSON.stringify({
    scene: [{ speaker_id: speakerId, text: opts.text }],
    context: falContextForSpeaker(speakerId),
  });
  const attempts: Array<{ url: string; headers: Record<string, string> }> = [];
  if (opts.falKey) {
    attempts.push({
      url: FAL_RUN_URL,
      headers: {
        Authorization: `Key ${opts.falKey}`,
        "Content-Type": "application/json",
        Accept: "application/json, audio/wav",
      },
    });
  }
  if (opts.hfToken) {
    attempts.push({
      url: HF_FAL_ROUTER_URL,
      headers: {
        Authorization: `Bearer ${opts.hfToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, audio/wav",
      },
    });
  }
  let lastError = "fal.ai CSM unavailable";
  let lastStatus = 502;
  for (const attempt of attempts) {
    try {
      const res = await fetchImpl(attempt.url, {
        method: "POST",
        headers: attempt.headers,
        body,
        signal: opts.signal,
      });
      const rawBuf = await res.arrayBuffer();
      const sniffed = sniffAudioContentType(rawBuf);
      if (res.ok && sniffed && rawBuf.byteLength >= 64) {
        return { ok: true, body: rawBuf, contentType: sniffed };
      }
      const raw = Buffer.from(rawBuf).toString("utf8");
      const json = safeJson(raw);
      const audioUrl = jsonAudioUrl(json);
      if (audioUrl) {
        const downloaded = await downloadAudioUrl(fetchImpl, audioUrl, opts.signal);
        if (downloaded) return { ok: true, ...downloaded };
      }
      const embedded = audioFromJson(json);
      if (embedded) return { ok: true, ...embedded };
      lastError = sesameErrorText(json) || raw.slice(0, 280) || `fal ${res.status}`;
      lastStatus = res.status || 502;
    } catch (err: any) {
      lastError = err?.message || "fal.ai network error";
      lastStatus = 502;
    }
  }
  return { ok: false, error: lastError, status: lastStatus };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function sesameUserMessage(code: string): string {
  switch (code) {
    case "sesame-no-token":
      return "Add Railway HF_TOKEN (Hugging Face Classic Read) and open huggingface.co/sesame/csm-1b to accept the license. CSM audio is generated by DeepInfra through that token.";
    case "sesame-unauthorized":
      return "Hugging Face rejected HF_TOKEN. Use a Classic Read token (hf_...) and accept the sesame/csm-1b license at huggingface.co/sesame/csm-1b.";
    case "sesame-gated":
      return "HF_TOKEN works, but sesame/csm-1b is gated. Open huggingface.co/sesame/csm-1b while logged in, click Agree, then retry Test Sesame Voice.";
    case "sesame-credits":
      return "Hugging Face Inference (DeepInfra) needs credits on this account. Add a payment method at huggingface.co/settings/billing or set DEEPINFRA_TOKEN / FAL_KEY.";
    case "sesame-gpu-quota":
      return "The public sesame/csm-1b Space asks for 180s of ZeroGPU and cannot run from Railway. CSM is served via DeepInfra with HF_TOKEN instead.";
    case "sesame-timeout":
      return "Sesame timed out waiting for GPU audio. Retry; rooms keep a browser voice until CSM returns.";
    case "sesame-skipped":
      return "Sesame is paused after a ZeroGPU error. Set FAL_KEY for a real GPU host, or retry after restart.";
    case "sesame-no-audio":
      return "Sesame /infer returned no audio file.";
    case "sesame-audio-download-failed":
      return "Sesame produced audio but the file could not be downloaded.";
    default:
      return "Sesame CSM-1B did not return audio. Accept the model license at huggingface.co/sesame/csm-1b, then retry. Rooms keep speaking with the on-device voice until this succeeds.";
  }
}
