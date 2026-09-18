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

export function sesameUserMessage(code: string): string {
  switch (code) {
    case "sesame-no-token":
      return "HF_TOKEN is missing on Railway. Add a Hugging Face Classic Read token (hf_...), then restart the service.";
    case "sesame-unauthorized":
      return "Hugging Face rejected HF_TOKEN. Create a Classic Read token (not Fine-grained) at huggingface.co/settings/tokens and paste it into Railway HF_TOKEN.";
    case "sesame-gpu-quota":
      return "Sesame's Space asks for 180s of ZeroGPU. Fine-grained or unused tokens are treated as guests (~120s) so /infer always fails. Use a Classic Read token, wait for Railway to restart, then test again.";
    case "sesame-timeout":
      return "Sesame timed out waiting for the Hugging Face Space. Retry in a minute; in-room tutors will use Edge until it recovers.";
    case "sesame-skipped":
      return "Sesame is paused for 10 minutes after a ZeroGPU quota error so rooms stay on Edge. Retry after that, or restart the service.";
    case "sesame-no-audio":
      return "Sesame /infer returned no audio file.";
    case "sesame-audio-download-failed":
      return "Sesame produced audio but the file could not be downloaded.";
    default:
      return "Sesame CSM-1B failed. In-room tutors keep speaking with Edge neural until this succeeds.";
  }
}
