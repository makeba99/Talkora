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
import { SttEngine } from "@/lib/ai-tutor/stt";
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
  "Heeey, I'm Afi K — pronounced Afi Key, don't laugh. What do you wanna do, gorgeous?",
  "Hiii! Afi K here. I welcome you to the room — talk to me, sing to me, anything goes.",
  "Oh hey, you called? Afi K, at your service. Are you okay? You seem like trouble — I like it.",
  "Afi K reporting in. What do you mean huh — what are we doing today, hmm?",
];

const AFIK_WELCOME_TEMPLATES = [
  "[SYSTEM: a new user named {name} just joined the room — give them a warm flirty welcome by name in 1-2 sentences and maybe invite them to sing or chat]",
  "[SYSTEM: {name} just walked into the room — welcome them in your charming Afi K voice in 1-2 sentences]",
];

const MALE_INTROS = [
  "Hey man, I'm Dude — your tutor. What are we practicing today?",
  "What's up! Dude here. Say something and let's roll.",
  "Hey! It's Dude. Ready when you are — what do you want to work on?",
];

// Eva — warm, emotional, natural (Sesame "Maya"-like). She introduces herself
// as Eva, never as "Dude" or "Afi K". Keep the lines short and personal so
// the ElevenLabs voice has room to breathe.
const EVA_INTROS = [
  "Hey, I'm Eva. So glad you're here — what's on your mind?",
  "Hi there. I'm Eva. Tell me anything — I'm listening.",
  "Hey you, I'm Eva. Take your time — what do you wanna talk about?",
  "Mmm hi, I'm Eva. Whenever you're ready, just start talking.",
];

const FALLBACK_RESPONSES = [
  "I heard you. Say that one more way?",
  "Got it. What part matters most?",
  "I'm following. Give me one more detail.",
  "Say it again, a little slower.",
  "What do you mean exactly?",
  "Keep going. I'm listening.",
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
    // 500ms delay — lets room echo fully fade before reopening the mic
    if (activeRef.current && !loadingRef.current) {
      setTimeout(() => sttRef.current?.startListening(), 500);
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
    ttsRef.current?.configure(aiSettings.voice, aiSettings.speed, aiSettings.voiceId);
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
    // 600ms — lets room echo fade so the mic doesn't immediately re-capture AI audio
    setTimeout(() => {
      if (activeRef.current && !speakingRef.current && !loadingRef.current) {
        sttRef.current?.startListening();
      }
    }, 600);
  }, [addDebug]);

  const onFinalTranscript = useCallback((text: string) => {
    const trimmed = text.trim();
    // Ignore fragments shorter than 3 characters — these are almost always echo
    // artifacts or noise picked up right after the AI finishes speaking
    if (trimmed.length < 3) return;
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

  // ── Send message to AI (streaming pipeline) ───────────────────────────────
  const sendAiMessage = useCallback(async (text: string) => {
    if (!text.trim() || loadingRef.current) return;

    interruptAi();

    loadingRef.current = true;
    setVoiceInterimText(null);

    const userMsg: ConversationEntry = { id: `u-${Date.now()}`, role: "user", text: text.trim() };
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
    const t0 = Date.now();

    setTimeout(() => setAiAcknowledging(false), 400);

    // Stop primary listening while streaming
    sttRef.current?.stopListening();

    try {
      const gotTokens = await streamTokens(
        {
          roomId,
          message: text.trim(),
          history: aiConversation.slice(-8),
          settings: aiSettings,
          language: roomLanguage,
          youtubeActive: ytActive,
          signal: abort.signal,
        },
        {
          onToken: token => {
            if (firstToken) {
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
            if (event === "switching_to_backup") addDebug("warn", "NVIDIA unavailable — switching to backup AI.");
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
        history: aiConversation.slice(-8),
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
        // Last resort: natural varied fallback
        const pick = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
        const fbMsg: ConversationEntry = { id: `a-${Date.now()}`, role: "ai", text: pick };
        setAiConversation(prev => [...prev, fbMsg]);
        ttsRef.current?.enqueue(pick);
        addDebug("error", "All AI calls failed — using hardcoded fallback.");
      }
    } finally {
      setAiLoading(false);
      setAiAcknowledging(false);
      loadingRef.current = false;
      abortRef.current = null;
      // Safety: if TTS never fires onEnd (empty response), restart listening anyway
      setTimeout(() => {
        if (activeRef.current && !speakingRef.current && !loadingRef.current) {
          sttRef.current?.startListening();
        }
      }, 1000);
    }
  }, [aiConversation, aiSettings, roomLanguage, activeYoutubeId, showYoutube, roomId, userId, socket, addDebug, interruptAi]);

  // Keep latest-version refs in sync so STT callbacks never call a stale closure
  useEffect(() => { sendAiMessageRef.current = sendAiMessage; }, [sendAiMessage]);
  useEffect(() => { interruptAiRef.current = interruptAi; }, [interruptAi]);

  // ── Start with a specific persona (voice + name, locked for session) ──────
  const startWithPersona = useCallback((voice: VoicePersona, pName: string) => {
    if (aiActive) return;
    // Lock the persona for this session
    personaLockedRef.current = true;
    setPersonaName(pName);

    // Update voice + avatar settings together so face matches gender
    const avatarId = voice === "Male" ? "nova" : "aurora";
    setAiSettings(s => ({ ...s, voice, voiceId: null, avatarId, personaName: pName }));
    // Also configure TTS immediately (don't wait for React state cycle)
    ttsRef.current?.configure(voice, aiSettings.speed, null);

    // Clear any previous mic error
    setMicError(null);
    sttRef.current?.resetMicDenied();

    socket?.emit("room:ai-tutor-start", { roomId, userId, username, avatarId, voice, voiceId: null });
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
    setTimeout(() => ttsRef.current?.enqueue(intro), 300);
    addDebug("info", `Session started with persona: ${pName} (${voice})`);
  }, [aiActive, socket, roomId, userId, username, aiSettings, addDebug]);

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
      setTimeout(() => ttsRef.current?.enqueue(intro), 300);
    } else {
      // Stop session — unlock persona
      personaLockedRef.current = false;
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

  // ── Start listening after AI active toggle ────────────────────────────────
  useEffect(() => {
    if (aiActive) {
      activeRef.current = true;
      // 250ms — gives the intro TTS time to start, then mic activates immediately after
      setTimeout(() => {
        if (activeRef.current && !speakingRef.current) sttRef.current?.startListening();
      }, 250);
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
      setAiRoomSession(prev => prev.active ? { ...prev, avatarId: data.avatarId ?? prev.avatarId, voice: data.voice === "Male" ? "Male" : "Female", voiceId: data.voiceId ?? prev.voiceId } : prev);
      observeSpeakText(data.text, data.voice || "Female", data.speed || 0.7, data.voiceId);
    };

    socket.on("room:ai-tutor-state", onState);
    socket.on("room:ai-tutor-busy", onBusy);
    socket.on("room:ai-tutor-disabled", onDisabled);
    socket.on("room:ai-tutor-enabled-changed", onEnabledChanged);
    socket.on("room:ai-tutor-message", onMessage);

    return () => {
      socket.off("room:ai-tutor-state", onState);
      socket.off("room:ai-tutor-busy", onBusy);
      socket.off("room:ai-tutor-disabled", onDisabled);
      socket.off("room:ai-tutor-enabled-changed", onEnabledChanged);
      socket.off("room:ai-tutor-message", onMessage);
    };
  }, [socket, userId, addDebug, toggleAiTutor, observeSpeakText]);

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
  };
}
