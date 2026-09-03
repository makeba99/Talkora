/**
 * useAiTutor — Core AI avatar hook.
 *
 * Composes the STT, TTS, and Stream modules into a single interface.
 * Exposes three isolated state containers:
 *   aiState    — AI session state (active, speaking, conversation, settings…)
 *   voiceState — Microphone / recognition state (listening, interimText, bargeIn)
 *   mediaState — External media conflicts (YouTube active, video ID)
 *
 * Implements:
 *  - Persona selection: Female (Afik) or Male (Dude Lebowski) — locked per session
 *  - Streaming pipeline: SSE tokens → sentence queue → TTS (speaks before full response)
 *  - True barge-in: parallel barge-in recognizer stops AI mid-sentence when user speaks
 *  - Interrupt logic: AbortController cancels in-flight stream; TTS queue drained
 *  - Anti-repetition: detects repeated AI replies and adds temperature jitter
 *  - Failsafe: SSE failure → buffered fallback → varied natural response
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { extractSentences } from "@/lib/ai-tutor/tts";
import { createTts, type TtsLike } from "@/lib/ai-tutor/tts-factory";
import { SttEngine, WakeWordDetector, FILLER_ONLY_PATTERN } from "@/lib/ai-tutor/stt";
import type { Viseme } from "@/lib/ai-tutor/lipsync";
import { streamTokens, fetchBufferedReply } from "@/lib/ai-tutor/stream";
import {
  DEFAULT_AI_SETTINGS,
  type AiState,
  type AiTutorSettings,
  type ConversationEntry,
  type DebugEntry,
  type DebugEntryType,
  type MediaState,
  type RoomAiSession,
  type VoiceState,
  type VoicePersona,
} from "@/lib/ai-tutor/types";
import type { Socket } from "socket.io-client";

export interface AiTutorDeps {
  socket: Socket | null;
  roomId: string;
  roomLanguage: string;
  userId: string | null;
  username: string | null;
  activeYoutubeId: string | null;
  showYoutube: boolean;
}

const FEMALE_INTROS = [
  "Hey, I'm Maya. So glad you're here — what's on your mind?",
  "Hi there. I'm Maya. Tell me anything — I'm listening.",
  "Hey you, I'm Maya. Take your time — what do you wanna talk about?",
  "Mmm hi, I'm Maya. Whenever you're ready, just start talking.",
];

const MALE_INTROS = [
  "Hey — I'm Miles. What's up?",
  "Miles here. Good to meet you — what do you want to practice?",
  "Yo, I'm Miles. Let's talk — what's on your mind?",
  "Hey. Miles. Whenever you're ready, just start.",
];

// Lebroskiu legacy intros kept for Eva persona if still selected elsewhere
const EVA_INTROS = [
  "Hey, I'm Lebroskiu. So glad you're here — what's on your mind?",
  "Hi there. I'm Lebroskiu. Tell me anything — I'm listening.",
  "Hey you, I'm Lebroskiu. Take your time — what do you wanna talk about?",
  "Mmm hi, I'm Lebroskiu. Whenever you're ready, just start talking.",
];

// Persona-queue item — requests from other room participants
interface AiQueueItem {
  text: string;
  fromUsername?: string;
}

const AFIK_WELCOME_TEMPLATES = [
  "[SYSTEM: a new user named {name} just joined the room — give them a warm welcome by name in 1-2 sentences]",
  "[SYSTEM: {name} just walked into the room — welcome them warmly in 1-2 sentences]",
];

const FALLBACK_RESPONSES = [
  "I heard you — say that one more way?",
  "Got it. What part matters most to you?",
  "Keep going — what did you mean exactly?",
  "Say it again, just a bit slower?",
  "I'm with you. What's the main thing you need?",
  "Almost got it. Give me one more detail.",
];

/** Short requests that likely need clarification before we can respond usefully. */
const CLARIFICATION_PROMPTS = [
  "Can you tell me a bit more about that?",
  "What exactly did you have in mind?",
  "Give me a little more to go on?",
  "Could you be a bit more specific?",
];

const AI_SETTINGS_STORAGE_KEY = "connect2talk-ai-tutor-settings-v1";

function loadSavedAiSettings(): AiTutorSettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;
  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw);
    const savedAvatarId = typeof parsed.avatarId === "string" ? parsed.avatarId : DEFAULT_AI_SETTINGS.avatarId;
    return {
      ...DEFAULT_AI_SETTINGS,
      ...parsed,
      voiceId: null,
      avatarId: ["aurora", "ember", "nova", "onyx"].includes(savedAvatarId) ? savedAvatarId : DEFAULT_AI_SETTINGS.avatarId,
      speed: typeof parsed.speed === "number" ? Math.max(0.5, Math.min(2, parsed.speed)) : DEFAULT_AI_SETTINGS.speed,
      tone: typeof parsed.tone === "number" ? Math.max(0, Math.min(1, parsed.tone)) : DEFAULT_AI_SETTINGS.tone,
      wakeWordEnabled: typeof parsed.wakeWordEnabled === "boolean" ? parsed.wakeWordEnabled : DEFAULT_AI_SETTINGS.wakeWordEnabled,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function useAiTutor(deps: AiTutorDeps) {
  const { socket, roomId, roomLanguage, userId, username, activeYoutubeId, showYoutube } = deps;

  // ── AI State ─────────────────────────────────────────────────────────────
  const [aiActive, setAiActive] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAcknowledging, setAiAcknowledging] = useState(false);
  const [aiChatPanelOpen, setAiChatPanelOpen] = useState(false);
  const [aiControlOpen, setAiControlOpen] = useState(false);
  const [aiTranscriptExpanded, setAiTranscriptExpanded] = useState(false);
  const [aiDebugOpen, setAiDebugOpen] = useState(false);
  const [aiLastBroadcast, setAiLastBroadcast] = useState<string | null>(null);
  const [aiConversation, setAiConversation] = useState<ConversationEntry[]>([]);
  const [aiDebugLog, setAiDebugLog] = useState<DebugEntry[]>([]);
  const [aiSettings, setAiSettings] = useState<AiTutorSettings>(() => loadSavedAiSettings());
  const [aiRoomEnabled, setAiRoomEnabled] = useState(true);
  const [aiRoomSession, setAiRoomSession] = useState<RoomAiSession>({
    active: false, userId: null, username: null, speaking: false,
  });

  // ── Persona State (locked per session) ────────────────────────────────────
  const [personaName, setPersonaName] = useState<string>("AI Tutor");
  const personaLockedRef = useRef(false);

  // ── Voice State ───────────────────────────────────────────────────────────
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceInterimText, setVoiceInterimText] = useState<string | null>(null);
  const [voiceBargeInActive, setVoiceBargeInActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [wakeListening, setWakeListening] = useState(false);

  // ── Lipsync State ─────────────────────────────────────────────────────────
  const [currentViseme, setCurrentViseme] = useState<Viseme>("rest");

  // ── Refs (mutable, never cause re-renders) ────────────────────────────────
  const activeRef = useRef(false);
  const speakingRef = useRef(false);
  const loadingRef = useRef(false);
  const chatPanelOpenRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Latest-version refs prevent stale closures in STT/TTS callbacks
  const sendAiMessageRef = useRef<((text: string) => void) | null>(null);
  const interruptAiRef = useRef<(() => void) | null>(null);
  // ── Request queue — handles questions from other room participants ─────────
  const aiQueueRef = useRef<AiQueueItem[]>([]);
  const queueProcessingRef = useRef(false);
  // ── Wake word detector ref ────────────────────────────────────────────────
  const wakeWordRef = useRef<WakeWordDetector | null>(null);
  // Stable ref so the wake callback never has a stale closure over toggleAiTutor
  const toggleAiTutorRef = useRef<(() => void) | null>(null);
  // Persists the admin-configured ElevenLabs voiceId across renders/persona switches.
  // Set once on mount from /api/ai-tutor/voice-config so startWithPersona can
  // pass it to ElevenLabs for Afik K (Female) without a race against React state.
  const serverVoiceIdRef = useRef<string | null>(null);
  // Separate male voice ID — the admin can configure a different ElevenLabs voice
  // for the Male (Dude) persona so both Female and Male use ElevenLabs voices.
  const serverMaleVoiceIdRef = useRef<string | null>(null);
  const serverTtsProviderRef = useRef<string>("unknown");

  // Keep refs in sync with state
  useEffect(() => { activeRef.current = aiActive; }, [aiActive]);
  useEffect(() => { speakingRef.current = aiSpeaking; }, [aiSpeaking]);
  useEffect(() => { loadingRef.current = aiLoading; }, [aiLoading]);
  useEffect(() => { chatPanelOpenRef.current = aiChatPanelOpen; }, [aiChatPanelOpen]);

  // ── Debug logger ──────────────────────────────────────────────────────────
  // Consecutive identical messages are collapsed into one with a repeat count
  // so the debug panel stays readable during mic-restart cycles.
  const addDebug = useCallback((type: DebugEntryType, message: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setAiDebugLog(prev => {
      const last = prev[prev.length - 1];
      if (last && last.message.replace(/ \(×\d+\)$/, "") === message && last.type === type) {
        // Same message — update the repeat count in place
        const count = (last.message.match(/\(×(\d+)\)$/) ? parseInt(last.message.match(/\(×(\d+)\)$/)![1]) : 1) + 1;
        const updated = { ...last, timestamp, message: `${message} (×${count})` };
        return [...prev.slice(0, -1), updated];
      }
      return [...prev.slice(-19), { timestamp, type, message }];
    });
  }, []);

  // ── Fetch server TTS voice config once on mount ───────────────────────────
  // Admin Brain/Voice panel stores OpenAI TTS voices (nova/onyx by default).
  // Propagate female/male voice names so personas route through /api/ai-tutor/tts
  // instead of browser SpeechSynthesis when Voice keys are configured.
  const refreshServerVoiceConfig = useCallback(() => {
    fetch("/api/ai-tutor/voice-config", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((cfg: { provider: string; voiceId: string | null; maleVoiceId?: string | null } | null) => {
        if (!cfg) return;
        serverTtsProviderRef.current = cfg.provider || "unknown";
        const cloud = cfg.provider === "openai" || cfg.provider === "elevenlabs";
        if (cloud && cfg.voiceId) {
          serverVoiceIdRef.current = cfg.voiceId;
          setAiSettings(s => ({ ...s, voiceId: cfg.voiceId }));
        }
        if (cloud && cfg.maleVoiceId) {
          serverMaleVoiceIdRef.current = cfg.maleVoiceId;
        }
        ttsRef.current?.configure(
          aiSettings.voice,
          aiSettings.speed,
          aiSettings.voiceId,
          serverTtsProviderRef.current,
        );
      })
      .catch(() => {});
  }, [aiSettings.voice, aiSettings.speed, aiSettings.voiceId]);

  useEffect(() => {
    refreshServerVoiceConfig();
    // Admin changes are cached server-side for 30 seconds. Refreshing here
    // prevents a room that stays open from using an old voice indefinitely.
    const timer = window.setInterval(refreshServerVoiceConfig, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshServerVoiceConfig]);

  // ── TTS Engine ────────────────────────────────────────────────────────────
  // Wrapped via createTts() — Eva routes to ElevenLabs, Female/Male use browser
  // reports availability, otherwise falls back to the browser SpeechSynthesis
  // engine. Either way the contract is identical.
  const ttsRef = useRef<TtsLike | null>(null);

  const onTtsStart = useCallback(() => {
    setAiSpeaking(true);
    speakingRef.current = true;
    socket?.emit("room:ai-tutor-speaking", { roomId, userId, speaking: true });
    // Start barge-in detector when AI begins speaking
    sttRef.current?.startBargeIn();
    setVoiceBargeInActive(true);
  }, [socket, roomId, userId]);

  const onTtsEnd = useCallback(() => {
    setAiSpeaking(false);
    speakingRef.current = false;
    setVoiceBargeInActive(false);
    sttRef.current?.stopBargeIn();
    socket?.emit("room:ai-tutor-speaking", { roomId, userId, speaking: false });
    // 180ms delay — lets room echo fade while keeping the turnaround snappy.
    // Reduced from 300ms to minimize perceived dead-air between AI response and mic ready.
    if (activeRef.current && !loadingRef.current) {
      setTimeout(() => sttRef.current?.startListening(), 180);
    }
  }, [socket, roomId, userId]);

  const onTtsSentenceEnd = useCallback(() => {}, []);

  useEffect(() => {
    ttsRef.current = createTts({
      onStart: onTtsStart,
      onEnd: onTtsEnd,
      onSentenceEnd: onTtsSentenceEnd,
      onViseme: (shape) => setCurrentViseme(shape),
      onVoiceId: () => {},
    });
    return () => ttsRef.current?.cancel();
  }, [onTtsStart, onTtsEnd, onTtsSentenceEnd]);

  useEffect(() => {
    ttsRef.current?.configure(
      aiSettings.voice,
      aiSettings.speed,
      aiSettings.voiceId,
      serverTtsProviderRef.current,
    );
  }, [aiSettings.voice, aiSettings.speed, aiSettings.voiceId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(aiSettings));
    }
    if (activeRef.current) {
      socket?.emit("room:ai-tutor-start", {
        roomId,
        userId,
        username,
        avatarId: aiSettings.avatarId,
        voice: aiSettings.voice,
        voiceId: aiSettings.voiceId,
      });
    }
  }, [aiSettings, socket, roomId, userId, username]);

  // ── STT Engine ────────────────────────────────────────────────────────────
  const sttRef = useRef<SttEngine | null>(null);

  // Stable callbacks that always call the latest function via ref
  const onBargeIn = useCallback(() => {
    addDebug("info", "Barge-in detected — interrupting AI.");
    setVoiceBargeInActive(false);
    interruptAiRef.current?.();
    // 220ms — lets echo fade while keeping the mic re-open snappy after interruption.
    // Reduced from 400ms so the user can speak again almost immediately.
    setTimeout(() => {
      if (activeRef.current && !speakingRef.current && !loadingRef.current) {
        sttRef.current?.startListening();
      }
    }, 220);
  }, [addDebug]);

  const onFinalTranscript = useCallback((text: string) => {
    const trimmed = text.trim();
    // Ignore fragments shorter than 3 characters — almost always echo artifacts
    if (trimmed.length < 3) return;
    // Ignore pure filler transcripts (um, uh, hmm…) — no real content to send
    if (FILLER_ONLY_PATTERN.test(trimmed)) {
      addDebug("info", `Filler filtered: "${trimmed}" — restarting mic`);
      setTimeout(() => {
        if (activeRef.current && !speakingRef.current && !loadingRef.current) {
          sttRef.current?.startListening();
        }
      }, 200);
      return;
    }

    // ── Incomplete-request detection ─────────────────────────────────────────
    // Single-word or extremely short inputs (≤4 chars after stripping punctuation)
    // are almost always incomplete thoughts. Ask for clarification rather than
    // guessing — this keeps the conversation natural and avoids wrong assumptions.
    const wordCount = trimmed.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean).length;
    if (wordCount === 1 && trimmed.length <= 8) {
      addDebug("info", `Short input "${trimmed}" — asking for clarification`);
      setVoiceInterimText(null);
      setVoiceListening(false);
      interruptAiRef.current?.();
      const prompt = CLARIFICATION_PROMPTS[Math.floor(Math.random() * CLARIFICATION_PROMPTS.length)];
      ttsRef.current?.enqueue(prompt);
      return;
    }

    setVoiceInterimText(null);
    setVoiceListening(false);
    addDebug("info", `Recognized: "${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}"`);
    interruptAiRef.current?.();
    // Use ref to avoid stale closure — sendAiMessage changes when aiConversation changes
    sendAiMessageRef.current?.(trimmed);
  }, [addDebug]);

  useEffect(() => {
    sttRef.current = new SttEngine(
      {
        onInterim: text => setVoiceInterimText(text),
        onFinal: onFinalTranscript,
        onStart: () => { setVoiceListening(true); addDebug("info", `Mic started — listening in ${roomLanguage}`); },
        onStop: () => { setVoiceListening(false); setVoiceInterimText(null); },
        onBargeIn,
        onError: msg => {
          addDebug("error", `STT: ${msg}`);
          setMicError(msg);
          if (!activeRef.current) return;
          // Speak a concise, actionable recovery prompt — short so it doesn't
          // talk over the user trying to fix the issue.
          if (/denied/i.test(msg)) {
            ttsRef.current?.enqueue("I can't hear you. Please allow microphone access in your browser, then try again.");
          } else if (msg === "network") {
            ttsRef.current?.enqueue("Connection issue — check your network and try again.");
          } else if (msg === "audio-capture") {
            ttsRef.current?.enqueue("Can't access the mic. Close any other app using it, then speak again.");
          } else if (/recognition-error:/i.test(msg)) {
            const REPEAT_PROMPTS = [
              "Didn't catch that — try again?",
              "Say it one more time?",
              "Come again?",
            ];
            ttsRef.current?.enqueue(REPEAT_PROMPTS[Math.floor(Math.random() * REPEAT_PROMPTS.length)]);
          }
        },
        onNoSpeechExtended: () => {
          if (!activeRef.current || speakingRef.current || loadingRef.current) return;
          const SILENCE_REMINDERS = [
            "Still there?",
            "Take your time — I'm listening.",
            "Whenever you're ready.",
            "I'm here. Just talk.",
            "No rush.",
          ];
          const pick = SILENCE_REMINDERS[Math.floor(Math.random() * SILENCE_REMINDERS.length)];
          addDebug("info", "Extended silence — speaking reminder");
          sttRef.current?.resetNoSpeechCount();
          ttsRef.current?.enqueue(pick);
        },
      },
      {
        panelOpen: chatPanelOpenRef,
        speaking: speakingRef,
        loading: loadingRef,
        active: activeRef,
      }
    );
    sttRef.current.setLanguage(roomLanguage);
    return () => sttRef.current?.stopAll();
  }, [roomLanguage, onBargeIn, onFinalTranscript, addDebug]);

  // Update STT language when room language changes
  useEffect(() => {
    sttRef.current?.setLanguage(roomLanguage);
  }, [roomLanguage]);

  // ── Interrupt ─────────────────────────────────────────────────────────────
  const interruptAi = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    ttsRef.current?.cancel();
    speakingRef.current = false;
    setAiSpeaking(false);
    setVoiceBargeInActive(false);
    sttRef.current?.stopBargeIn();
  }, []);

  // ── Request queue processor ───────────────────────────────────────────────
  // Drains aiQueueRef one item at a time. Called after each sendAiMessage
  // completes so multiple users are answered sequentially, never simultaneously.
  const processNextQueued = useCallback(() => {
    if (queueProcessingRef.current) return;
    if (aiQueueRef.current.length === 0) return;
    if (!activeRef.current) return;
    queueProcessingRef.current = true;
    const next = aiQueueRef.current.shift()!;
    // Prefix the text with the asker's name so the AI knows who asked
    const prefixed = next.fromUsername
      ? `[${next.fromUsername} asks]: ${next.text}`
      : next.text;
    addDebug("info", `Queue: sending question from ${next.fromUsername || "someone"}`);
    // Use a promise chain so we process the next item only after this one is done
    Promise.resolve().then(() => sendAiMessageRef.current?.(prefixed)).finally(() => {
      queueProcessingRef.current = false;
      // Check if more items arrived while we were processing
      if (aiQueueRef.current.length > 0) {
        setTimeout(processNextQueued, 200);
      }
    });
  }, [addDebug]);

  // ── Send message to AI (streaming pipeline) ───────────────────────────────
  const sendAiMessage = useCallback(async (text: string) => {
    if (!text.trim() || loadingRef.current) return;

    interruptAi();

    loadingRef.current = true;
    setVoiceInterimText(null);

    const userMsg: ConversationEntry = { id: `u-${Date.now()}`, role: "user", text: text.trim() };
    // Prior turns only (current message is sent separately). Filter empty
    // streaming bubbles so the model never sees blank assistant rows.
    const historyForApi = aiConversation
      .filter((m) => typeof m.text === "string" && m.text.trim().length > 0)
      .slice(-12);
    setAiConversation(prev => [...prev, userMsg]);
    setAiLoading(true);
    setAiAcknowledging(true);

    const ytActive = !!activeYoutubeId && showYoutube;
    if (ytActive) addDebug("yt", "YouTube active during AI session — potential audio conflict.");

    const streamingId = `a-${Date.now()}`;
    setAiConversation(prev => [...prev, { id: streamingId, role: "ai", text: "" }]);

    const abort = new AbortController();
    abortRef.current = abort;

    let fullReply = "";
    let sentenceBuffer = "";
    let firstToken = true;
    let firstTokenFired = false;
    const t0 = Date.now();

    setTimeout(() => setAiAcknowledging(false), 400);

    // ── Immediate receipt acknowledgment ─────────────────────────────────────
    // Fires at ~0ms (no delay) to confirm the AI received the input.
    // ~35% probability per turn — keeps it natural and non-repetitive.
    // Very short phrases (<300ms of audio) so the actual response still
    // feels fast. Mutually exclusive with the thinking phrase below:
    // only one preamble per turn to avoid double stacking ("Mm. One sec.").
    const RECEIPT_CUES = ["Mm.", "Mm-hmm.", "Right.", "Yeah.", "Okay."];
    const playReceiptCue = Math.random() < 0.35;
    if (playReceiptCue) {
      ttsRef.current?.enqueue(RECEIPT_CUES[Math.floor(Math.random() * RECEIPT_CUES.length)]);
      addDebug("info", "Receipt cue played — immediate ACK");
    }

    // ── Latency-acknowledgment guard ─────────────────────────────────────────
    // If the LLM hasn't sent its first token within 500ms AND no receipt cue
    // was played, speak a brief "thinking" phrase to fill the silence.
    // Cleared immediately when the first token arrives, so fast responses
    // (common on subsequent turns) never hear the phrase at all.
    const THINKING_PHRASES = [
      "Hmm.",
      "Let me think.",
      "One sec.",
      "Got it, hold on.",
      "Mm, give me a moment.",
    ];
    const thinkingTimer = setTimeout(() => {
      if (!firstTokenFired && !playReceiptCue && !abort.signal.aborted && activeRef.current && !speakingRef.current) {
        ttsRef.current?.enqueue(THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]);
        addDebug("info", `Thinking phrase spoken — first token delayed >${Date.now() - t0}ms`);
      }
    }, 500);

    // Stop primary listening while streaming
    sttRef.current?.stopListening();

    try {
      const gotTokens = await streamTokens(
        {
          roomId,
          message: text.trim(),
          history: historyForApi,
          settings: aiSettings,
          language: roomLanguage,
          youtubeActive: ytActive,
          signal: abort.signal,
        },
        {
          onToken: token => {
            if (firstToken) {
              firstTokenFired = true;
              clearTimeout(thinkingTimer);
              addDebug("info", `First token in ${Date.now() - t0}ms`);
              firstToken = false;
            }
            sentenceBuffer += token;
            fullReply += token;

            // Update streaming bubble in real-time
            setAiConversation(prev =>
              prev.map(m => m.id === streamingId ? { ...m, text: fullReply } : m)
            );

            // Flush complete sentences to TTS immediately (speak before full response)
            const [sentences, remainder] = extractSentences(sentenceBuffer);
            sentenceBuffer = remainder;
            sentences.forEach(s => ttsRef.current?.enqueue(s));
          },
          onMeta: event => {
            if (event === "switching_to_backup") addDebug("warn", "Primary AI unavailable — switching to backup.");
          },
          onDone: (model, latencyMs) => {
            addDebug("info", `Stream complete in ${latencyMs}ms · model: ${model}`);
            if (sentenceBuffer.trim()) ttsRef.current?.enqueue(sentenceBuffer.trim());
            sentenceBuffer = "";
            if (fullReply.trim()) {
              setAiLastBroadcast(fullReply);
              socket?.emit("room:ai-tutor-message", {
                roomId, userId, text: fullReply,
                voice: aiSettings.voice, voiceId: aiSettings.voiceId, speed: aiSettings.speed, avatarId: aiSettings.avatarId,
              });
            }
          },
          onError: msg => addDebug("error", `Stream error: ${msg}`),
        }
      );

      if (!gotTokens || !fullReply.trim()) {
        setAiConversation(prev => prev.filter(m => m.id !== streamingId));
        throw new Error("Empty stream response");
      }

    } catch (err: any) {
      if (err?.name === "AbortError") {
        addDebug("info", "Stream cancelled — user interrupted.");
        if (!fullReply.trim()) setAiConversation(prev => prev.filter(m => m.id !== streamingId));
        return;
      }

      addDebug("warn", `Streaming failed (${err?.message}) — using buffered fallback.`);
      setAiConversation(prev => prev.filter(m => m.id !== streamingId));

      const fallback = await fetchBufferedReply({
        roomId,
        message: text.trim(),
        history: historyForApi,
        settings: aiSettings,
        language: roomLanguage,
        youtubeActive: ytActive,
      });

      if (fallback?.reply) {
        addDebug("info", `Buffered fallback: ${fallback.model || "unknown"} in ${Date.now() - t0}ms`);
        const fbMsg: ConversationEntry = {
          id: `a-${Date.now()}`, role: "ai", text: fallback.reply,
          correction: fallback.correction ?? undefined,
          correctionFixed: fallback.correctionFixed ?? undefined,
        };
        setAiConversation(prev => [...prev, fbMsg]);
        setAiLastBroadcast(fallback.reply);
        socket?.emit("room:ai-tutor-message", { roomId, userId, text: fallback.reply, voice: aiSettings.voice, voiceId: aiSettings.voiceId, speed: aiSettings.speed, avatarId: aiSettings.avatarId });
        ttsRef.current?.enqueue(fallback.reply);
      } else {
        const errDetail = (fallback as any)?.error || err?.message || "";
        const needsKey = /not configured|missing_api|OPENAI|no_openai|503/i.test(String(errDetail));
        const errText = needsKey
          ? "My brain is offline — an admin needs to set an OpenAI API key in Admin → AI Tutor (or OPENAI_API_KEY on the server)."
          : "Talking AI is unavailable right now. Please try again in a moment.";
        const fbMsg: ConversationEntry = { id: `a-${Date.now()}`, role: "ai", text: errText };
        setAiConversation(prev => [...prev, fbMsg]);
        // Always speak the error so the tutor never goes silent (browser TTS fallback).
        try {
          ttsRef.current?.configure(aiSettings.voice, aiSettings.speed, null, "browser");
          ttsRef.current?.enqueue(errText);
        } catch { /* ignore */ }
        addDebug("error", `All AI calls failed: ${errDetail || "unknown"}`);
      }
    } finally {
      clearTimeout(thinkingTimer);
      setAiLoading(false);
      setAiAcknowledging(false);
      loadingRef.current = false;
      abortRef.current = null;
      // Safety: if TTS never fires onEnd (empty response), restart listening anyway
      setTimeout(() => {
        if (activeRef.current && !speakingRef.current && !loadingRef.current) {
          sttRef.current?.startListening();
        }
        // Auto-drain queue — process next queued question if any
        if (aiQueueRef.current.length > 0) {
          setTimeout(processNextQueued, 600);
        }
      }, 1000);
    }
  }, [aiConversation, aiSettings, roomLanguage, activeYoutubeId, showYoutube, roomId, userId, socket, addDebug, interruptAi, processNextQueued]);

  // Keep latest-version refs in sync so STT callbacks never call a stale closure
  useEffect(() => { sendAiMessageRef.current = sendAiMessage; }, [sendAiMessage]);
  useEffect(() => { interruptAiRef.current = interruptAi; }, [interruptAi]);

  // Enqueue a question from another room participant
  const enqueueAiRequest = useCallback((text: string, fromUsername?: string) => {
    if (!activeRef.current || !text.trim()) return;
    aiQueueRef.current.push({ text: text.trim(), fromUsername });
    addDebug("info", `Queued question from ${fromUsername || "participant"} (queue size: ${aiQueueRef.current.length})`);
    // If AI is idle, start processing immediately
    if (!loadingRef.current && !speakingRef.current) {
      processNextQueued();
    }
    // Otherwise it will auto-drain after the current response finishes
  }, [addDebug, processNextQueued]);

  // ── Start with a specific persona (voice + name, locked for session) ──────
  const startWithPersona = useCallback((voice: VoicePersona, pName: string) => {
    // If a session is already running, fully tear it down first so the new
    // persona actually takes effect. The previous early-return caused a real
    // bug: clicking Eva while a Dude session was still active silently kept
    // playing Dude's male browser voice — the picker would close but the
    // voice never switched. Now we always honour the user's new pick.
    if (aiActive) {
      try { ttsRef.current?.cancel(); } catch {}
      try { sttRef.current?.stopAll(); } catch {}
      try { abortRef.current?.abort(); } catch {}
      socket?.emit("room:ai-tutor-stop", { roomId, userId });
      // Local state reset — mirrors the stop branch of toggleAiTutor
      setAiSpeaking(false);
      setAiLoading(false);
      setVoiceInterimText(null);
      setVoiceListening(false);
      setVoiceBargeInActive(false);
      setAiAcknowledging(false);
      // We're about to flip aiActive back to true with the new persona,
      // so don't bother flipping it false in between.
    }
    // Lock the persona for this session
    personaLockedRef.current = true;
    setPersonaName(pName);

    // Update voice + avatar settings together so face matches gender.
    // Female (Afik K) gets the admin-configured female ElevenLabs voiceId (Lebroskiu etc.).
    // Male (Dude) gets the admin-configured male ElevenLabs voiceId (Adam, Daniel, etc.).
    const avatarId = voice === "Male" ? "nova" : "aurora";
    const voiceId = voice === "Female"
      ? serverVoiceIdRef.current
      : voice === "Male"
        ? (serverMaleVoiceIdRef.current || serverVoiceIdRef.current)
        : null;
    setAiSettings(s => ({ ...s, voice, voiceId, avatarId, personaName: pName }));
    // Also configure TTS immediately (don't wait for React state cycle)
    ttsRef.current?.configure(voice, aiSettings.speed, voiceId, serverTtsProviderRef.current);

    // Clear any previous mic error
    setMicError(null);
    sttRef.current?.resetMicDenied();

    socket?.emit("room:ai-tutor-start", { roomId, userId, username, avatarId, voice, voiceId });
    setAiActive(true);
    setAiChatPanelOpen(false);
    chatPanelOpenRef.current = false;
    setAiConversation([]);
    setAiDebugLog([]);
    setAiLastBroadcast(null);

    // Persona-specific intro — Eva gets her own warm, female intros so she
    // never says "I'm Dude" or "I'm Afi K" through the ElevenLabs voice.
    const intros = voice === "Eva"
      ? EVA_INTROS
      : voice === "Female"
        ? FEMALE_INTROS
        : MALE_INTROS;
    const intro = intros[Math.floor(Math.random() * intros.length)];
    const introMsg: ConversationEntry = { id: `a-intro-${Date.now()}`, role: "ai", text: intro };
    setAiConversation([introMsg]);
    setTimeout(() => ttsRef.current?.enqueue(intro), 10);
    addDebug("info", `Session started with persona: ${pName} (${voice})`);
  }, [aiActive, socket, roomId, userId, username, aiSettings, addDebug]);

  // ── Keep toggleAiTutorRef in sync (wake callback uses this to avoid stale closure) ──
  // Must be placed AFTER toggleAiTutor is defined below.
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // ── Toggle AI Tutor session (stop only — use startWithPersona to start) ──
  const toggleAiTutor = useCallback(() => {
    if (!aiActive) {
      // Default start (no persona selection — use current settings)
      socket?.emit("room:ai-tutor-start", { roomId, userId, username, avatarId: aiSettings.avatarId, voice: aiSettings.voice, voiceId: aiSettings.voiceId });
      setAiActive(true);
      setAiChatPanelOpen(false);
      chatPanelOpenRef.current = false;
      setAiConversation([]);
      setAiDebugLog([]);
      setAiLastBroadcast(null);
      const intros = aiSettings.voice === "Eva"
        ? EVA_INTROS
        : aiSettings.voice === "Male"
          ? MALE_INTROS
          : FEMALE_INTROS;
      const intro = intros[Math.floor(Math.random() * intros.length)];
      const introMsg: ConversationEntry = { id: `a-intro-${Date.now()}`, role: "ai", text: intro };
      setAiConversation([introMsg]);
      setTimeout(() => ttsRef.current?.enqueue(intro), 10);
    } else {
      // Stop session — unlock persona and drain queue
      personaLockedRef.current = false;
      aiQueueRef.current = [];
      queueProcessingRef.current = false;
      sttRef.current?.stopAll();
      ttsRef.current?.cancel();
      abortRef.current?.abort();
      socket?.emit("room:ai-tutor-stop", { roomId, userId });
      setAiActive(false);
      setAiSpeaking(false);
      setAiLoading(false);
      setAiControlOpen(false);
      setAiConversation([]);
      setAiLastBroadcast(null);
      setAiDebugLog([]);
      setVoiceInterimText(null);
      setVoiceListening(false);
      setVoiceBargeInActive(false);
      setAiAcknowledging(false);
      setAiTranscriptExpanded(false);
      setPersonaName("AI Tutor");
    }
  }, [aiActive, socket, roomId, userId, username, aiSettings]);

  // Keep the wake callback's ref current every time toggleAiTutor is recreated
  useEffect(() => { toggleAiTutorRef.current = toggleAiTutor; }, [toggleAiTutor]);

  // ── Observe AI message from another user in the room ─────────────────────
  // Uses the same factory so observers hear the same voice the active
  // speaker is hearing.
  const observeSpeakText = useCallback((text: string, voice: string, speed: number, voiceId?: string | null) => {
    const engine = createTts({
      onStart: () => setCurrentViseme("open"),
      onEnd: () => setCurrentViseme("rest"),
      onSentenceEnd: () => {},
      onViseme: shape => setCurrentViseme(shape),
    });
    engine.configure(voice as VoicePersona, speed, voiceId);
    engine.enqueue(text);
  }, []);

  // ── Wake word detector — lifecycle ───────────────────────────────────────
  // Created once. Starts passively when AI is inactive so users can say
  // "hey AI" / "hey tutor" / "hey Eva" / etc. to activate hands-free.
  // Stops as soon as AI becomes active (primary STT takes over the mic).
  useEffect(() => {
    const detector = new WakeWordDetector(
      // onWake — fired when a trigger phrase is detected
      (afterText: string) => {
        addDebug("info", `Wake word detected${afterText ? ` — "${afterText}"` : ""}`);
        // Activate AI using whatever persona the user last selected
        toggleAiTutorRef.current?.();
        // If the user already asked something in the same breath, queue it up
        // after a short delay to let the intro TTS start first
        if (afterText) {
          // 600ms — intro TTS starts at ~50ms; this gives it time to begin
          // then sendAiMessage naturally interrupts it to answer the user's question.
          // Reduced from 900ms so the user gets a response faster on wake+query combos.
          setTimeout(() => {
            sendAiMessageRef.current?.(afterText);
          }, 600);
        }
      },
      // onStatusChange — keeps the UI indicator in sync
      (listening: boolean) => setWakeListening(listening)
    );
    wakeWordRef.current = detector;
    return () => {
      detector.stop();
      wakeWordRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-once — detector is stable, callbacks use refs

  // toggleAiTutorRef is assigned below after the function is defined (see the
  // useEffect that depends on [toggleAiTutor]).  The placeholder keeps ESLint happy.

  // Start / stop the wake word detector based on AI active state and user preference
  useEffect(() => {
    if (aiActive || !aiSettings.wakeWordEnabled) {
      // AI is already active, or user disabled the wake word feature — stop detector
      wakeWordRef.current?.stop();
    } else {
      // AI is inactive and wake word is enabled — start the background listener
      wakeWordRef.current?.start();
    }
  }, [aiActive, aiSettings.wakeWordEnabled]);

  // Keep wake detector language in sync with room language changes
  useEffect(() => {
    wakeWordRef.current?.setLanguage(
      // Re-use the same lang map as SttEngine (already resolved in sttRef via setLanguage)
      // We just call setLanguage on the detector; it will apply on next restart
      roomLanguage
    );
  }, [roomLanguage]);

  // ── Start listening after AI active toggle ────────────────────────────────
  useEffect(() => {
    if (aiActive) {
      activeRef.current = true;
      // 100ms — gives the intro TTS a single tick to start before the mic opens
      setTimeout(() => {
        if (activeRef.current && !speakingRef.current) sttRef.current?.startListening();
      }, 100);
    } else {
      activeRef.current = false;
      sttRef.current?.stopAll();
    }
  }, [aiActive]);

  // ── Socket event handlers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onState = (data: { active: boolean; userId: string | null; username: string | null; speaking: boolean; avatarId?: string | null; voice?: VoicePersona | null; voiceId?: string | null }) => {
      setAiRoomSession(data);
    };

    const onBusy = (data: { userId: string; username: string }) => {
      addDebug("warn", `AI Tutor busy — ${data.username} is already using it.`);
    };

    const onDisabled = () => {
      addDebug("warn", "AI Tutor disabled by host.");
      if (activeRef.current) toggleAiTutor();
    };

    const onEnabledChanged = (data: { enabled: boolean }) => {
      setAiRoomEnabled(data.enabled);
    };

    const onMessage = (data: {
      userId: string; username: string; text: string;
      correction?: string | null; correctionFixed?: string | null;
      voice?: string; voiceId?: string | null; speed?: number; avatarId?: string | null;
    }) => {
      if (data.userId === userId) return; // own message — already in conversation
      const msg: ConversationEntry = {
        id: `obs-${Date.now()}`,
        role: "ai",
        text: data.text,
        correction: data.correction ?? undefined,
        correctionFixed: data.correctionFixed ?? undefined,
      };
      setAiConversation(prev => [...prev, msg]);
      setAiLastBroadcast(data.text);
      setAiRoomSession(prev => prev.active ? { ...prev, avatarId: data.avatarId ?? prev.avatarId, voice: data.voice === "Male" ? "Male" : data.voice === "Eva" ? "Eva" : "Female", voiceId: data.voiceId ?? prev.voiceId } : prev);
      observeSpeakText(data.text, data.voice || "Female", data.speed || 0.7, data.voiceId);
    };

    // ── room:ai-ask — a non-owner participant asks the AI a question ──────────
    // Only the session owner receives this (server routes it to the owner's socket).
    const onAiAsk = (data: { fromUserId: string; fromUsername: string; question: string }) => {
      enqueueAiRequest(data.question, data.fromUsername);
    };

    socket.on("room:ai-tutor-state", onState);
    socket.on("room:ai-tutor-busy", onBusy);
    socket.on("room:ai-tutor-disabled", onDisabled);
    socket.on("room:ai-tutor-enabled-changed", onEnabledChanged);
    socket.on("room:ai-tutor-message", onMessage);
    socket.on("room:ai-ask", onAiAsk);

    return () => {
      socket.off("room:ai-tutor-state", onState);
      socket.off("room:ai-tutor-busy", onBusy);
      socket.off("room:ai-tutor-disabled", onDisabled);
      socket.off("room:ai-tutor-enabled-changed", onEnabledChanged);
      socket.off("room:ai-tutor-message", onMessage);
      socket.off("room:ai-ask", onAiAsk);
    };
  }, [socket, userId, addDebug, toggleAiTutor, observeSpeakText, enqueueAiRequest]);

  // ── Assembled state containers ────────────────────────────────────────────
  const aiState: AiState = {
    active: aiActive,
    speaking: aiSpeaking,
    loading: aiLoading,
    listening: voiceListening,
    acknowledging: aiAcknowledging,
    chatPanelOpen: aiChatPanelOpen,
    controlOpen: aiControlOpen,
    transcriptExpanded: aiTranscriptExpanded,
    debugOpen: aiDebugOpen,
    interimText: voiceInterimText,
    lastBroadcast: aiLastBroadcast,
    conversation: aiConversation,
    debugLog: aiDebugLog,
    settings: aiSettings,
    roomEnabled: aiRoomEnabled,
    roomSession: aiRoomSession,
  };

  const voiceState: VoiceState = {
    listening: voiceListening,
    interimText: voiceInterimText,
    bargeInActive: voiceBargeInActive,
    micError,
    wakeListening,
  };

  const mediaState: MediaState = {
    youtubeActive: !!activeYoutubeId && showYoutube,
    youtubeId: activeYoutubeId,
  };

  const clearDebugLog = useCallback(() => setAiDebugLog([]), []);
  const setRoomAiTutorEnabled = useCallback((val: boolean) => setAiRoomEnabled(val), []);

  // ── Welcome a new joiner via AI (used by Afi K personality) ──────────────
  const welcomeUser = useCallback((name: string) => {
    if (!activeRef.current) return;
    const tpl = AFIK_WELCOME_TEMPLATES[Math.floor(Math.random() * AFIK_WELCOME_TEMPLATES.length)];
    const sysMsg = tpl.replace("{name}", name);
    sendAiMessageRef.current?.(sysMsg);
  }, []);

  return {
    // State containers (as per spec)
    aiState,
    voiceState,
    mediaState,

    // Persona
    personaName,
    personaLocked: personaLockedRef.current,

    // Lipsync
    currentViseme,

    // Setters (for UI controls)
    setAiChatPanelOpen,
    setAiControlOpen,
    setAiDebugOpen,
    setAiTranscriptExpanded,
    setAiSettings,
    clearDebugLog,
    setRoomAiTutorEnabled,

    // Core actions
    toggleAiTutor,
    startWithPersona,
    sendAiMessage,
    interruptAi,
    welcomeUser,
    addDebug,
    enqueueAiRequest,
  };
}
