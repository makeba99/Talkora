// "Eva" is the ElevenLabs-powered voice persona. Female/Male keep using the
// browser SpeechSynthesis engine (the original "Afi K" / "Dude" personas).
export type VoicePersona = "Female" | "Male" | "Eva";

export interface AiTutorSettings {
  correctionMode: "live" | "after" | "off";
  teachingStyle: string;
  personality: string;
  voice: VoicePersona;
  voiceId?: string | null;
  avatarId: string;
  speed: number;
  tone: number;
  personaName?: string;
}

export interface ConversationEntry {
  id: string;
  role: "ai" | "user";
  text: string;
  correction?: string;
  correctionFixed?: string;
}

export type DebugEntryType = "info" | "warn" | "error" | "yt";

export interface DebugEntry {
  timestamp: string;
  type: DebugEntryType;
  message: string;
}

export interface RoomAiSession {
  active: boolean;
  userId: string | null;
  username: string | null;
  speaking: boolean;
  avatarId?: string | null;
  voice?: VoicePersona | null;
  voiceId?: string | null;
}

export interface AiState {
  active: boolean;
  speaking: boolean;
  loading: boolean;
  listening: boolean;
  acknowledging: boolean;
  chatPanelOpen: boolean;
  controlOpen: boolean;
  transcriptExpanded: boolean;
  debugOpen: boolean;
  interimText: string | null;
  lastBroadcast: string | null;
  conversation: ConversationEntry[];
  debugLog: DebugEntry[];
  settings: AiTutorSettings;
  roomEnabled: boolean;
  roomSession: RoomAiSession;
}

export interface VoiceState {
  listening: boolean;
  interimText: string | null;
  bargeInActive: boolean;
  micError: string | null;
}

export interface MediaState {
  youtubeActive: boolean;
  youtubeId: string | null;
}

export const SPEECH_LANG_MAP: Record<string, string> = {
  English: "en-US",
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Italian: "it-IT",
  Portuguese: "pt-PT",
  Russian: "ru-RU",
  Arabic: "ar-SA",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Chinese: "zh-CN",
  Hindi: "hi-IN",
  Turkish: "tr-TR",
  Dutch: "nl-NL",
  Polish: "pl-PL",
  Vietnamese: "vi-VN",
  Indonesian: "id-ID",
  Thai: "th-TH",
  Armenian: "hy-AM",
};

export const DEFAULT_AI_SETTINGS: AiTutorSettings = {
  correctionMode: "live",
  teachingStyle: "Conversation",
  personality: "Friendly",
  voice: "Female",
  voiceId: null,
  avatarId: "aurora",
  speed: 0.7,
  tone: 0.7,
};
