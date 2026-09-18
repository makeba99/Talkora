export type VoiceSynthesizeRequest = {
  text: string;
  /** Partner id (maya/miles) or a concrete provider voice id. */
  voiceId: string;
  /** Reserved for self-hosted CSM next-turn context. Unused by the hosted Space. */
  conversationContext?: string[];
  signal?: AbortSignal;
};

export type VoiceSynthesizeResult = {
  ok: boolean;
  status: number;
  contentType: string;
  body?: ArrayBuffer;
  error?: string;
  voiceUsed: string;
  provider: string;
};

export type VoiceHealth = {
  available: boolean;
  reachable: boolean;
  detail?: string;
};

export interface VoiceProvider {
  id: string;
  synthesize(req: VoiceSynthesizeRequest): Promise<VoiceSynthesizeResult>;
  health(): Promise<VoiceHealth>;
}

export const SESAME_INFER_API = "/infer" as const;
export const SESAME_UPDATE_AUDIO_A = "/update_audio" as const;
export const SESAME_UPDATE_AUDIO_B = "/update_audio_1" as const;
export const SESAME_UPDATE_TEXT_A = "/update_text" as const;
export const SESAME_UPDATE_TEXT_B = "/update_text_1" as const;
