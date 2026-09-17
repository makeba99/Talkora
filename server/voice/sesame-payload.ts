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

export function sesameHfToken(): string {
  return (process.env.HF_TOKEN || process.env.AI_VOICE_HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "").trim();
}
