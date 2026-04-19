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
 *  - Streaming pipeline: SSE tokens → sentence queue → TTS (speaks before full response)
 *  - True barge-in: parallel barge-in recognizer stops AI mid-sentence when user speaks
 *  - Interrupt logic: AbortController cancels in-flight stream; TTS queue drained
 *  - Anti-repetition: detects repeated AI replies and adds temperature jitter
 *  - Failsafe: SSE failure → buffered fallback → varied natural response
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { TtsEngine, extractSentences } from "@/lib/ai-tutor/tts";
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

const INTRO_TEXTS = [
  "I'm listening. What do you want to practice?",
  "Tell me something, and I'll help.",
  "Ready. What should we work on?",
  "I'm here. Say a sentence.",
  "Let's practice. What's first?",
];

const FALLBACK_RESPONSES = [
  "I heard you. Say that one more way?",
  "Got it. What part matters most?",
  "I’m following. Give me one more detail.",
  "Say it again, a little slower.",
  "What do you mean exactly?",
  "Keep going. I’m listening.",
];

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
  const [aiSettings, setAiSettings] = useState<AiTutorSettings>(DEFAULT_AI_SETTINGS);
  const [aiRoomEnabled, setAiRoomEnabled] = useState(true);
  const [aiRoomSession, setAiRoomSession] = useState<RoomAiSession>({
    active: false, userId: null, username: null, speaking: false,
  });

  // ── Voice State ───────────────────────────────────────────────────────────
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceInterimText, setVoiceInterimText] = useState<string | null>(null);
  const [voiceBargeInActive, setVoiceBargeInActive] = useState(false);

  // ── Lipsync State ─────────────────────────────────────────────────────────
  const [currentViseme, setCurrentViseme] = useState<Viseme>("rest");

  // ── Refs (mutable, never cause re-renders) ────────────────────────────────
  const activeRef = useRef(false);
  const speakingRef = useRef(false);
  const loadingRef = useRef(false);
  const chatPanelOpenRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Keep refs in sync with state
  useEffect(() => { activeRef.current = aiActive; }, [aiActive]);
  useEffect(() => { speakingRef.current = aiSpeaking; }, [aiSpeaking]);
  useEffect(() => { loadingRef.current = aiLoading; }, [aiLoading]);
  useEffect(() => { chatPanelOpenRef.current = aiChatPanelOpen; }, [aiChatPanelOpen]);

  // ── Debug logger ──────────────────────────────────────────────────────────
  const addDebug = useCallback((type: DebugEntryType, message: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setAiDebugLog(prev => [...prev.slice(-19), { timestamp, type, message }]);
  }, []);

  // ── TTS Engine ────────────────────────────────────────────────────────────
  const ttsRef = useRef<TtsEngine | null>(null);

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
    // Always restart listening when AI finishes speaking — not gated on panel state
    if (activeRef.current && !loadingRef.current) {
      setTimeout(() => sttRef.current?.startListening(), 400);
    }
  }, [socket, roomId, userId]);

  const onTtsSentenceEnd = useCallback(() => {}, []);

  useEffect(() => {
    ttsRef.current = new TtsEngine({
      onStart: onTtsStart,
      onEnd: onTtsEnd,
      onSentenceEnd: onTtsSentenceEnd,
      onViseme: (shape) => setCurrentViseme(shape),
    });
    return () => ttsRef.current?.cancel();
  }, [onTtsStart, onTtsEnd, onTtsSentenceEnd]);

  useEffect(() => {
    ttsRef.current?.configure(aiSettings.voice, aiSettings.speed);
  }, [aiSettings.voice, aiSettings.speed]);

  // ── STT Engine ────────────────────────────────────────────────────────────
  const sttRef = useRef<SttEngine | null>(null);

  const onBargeIn = useCallback(() => {
    addDebug("info", "Barge-in detected — interrupting AI.");
    setVoiceBargeInActive(false);
    interruptAi();
    // Give a short gap then restart full listening
    setTimeout(() => {
      if (activeRef.current) sttRef.current?.startListening();
    }, 200);
  }, [addDebug]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFinalTranscript = useCallback((text: string) => {
    setVoiceInterimText(null);
    setVoiceListening(false);
    addDebug("info", `Recognized: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"`);
    interruptAi();
    sendAiMessage(text);
  }, [addDebug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sttRef.current = new SttEngine(
      {
        onInterim: text => setVoiceInterimText(text),
        onFinal: onFinalTranscript,
        onStart: () => { setVoiceListening(true); addDebug("info", `Mic started — listening in ${roomLanguage}`); },
        onStop: () => { setVoiceListening(false); setVoiceInterimText(null); },
        onBargeIn,
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

    setTimeout(() => setAiAcknowledging(false), 600);

    // Stop primary listening while streaming
    sttRef.current?.stopListening();

    try {
      const gotTokens = await streamTokens(
        {
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
                voice: aiSettings.voice, speed: aiSettings.speed,
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
        socket?.emit("room:ai-tutor-message", { roomId, userId, text: fallback.reply, voice: aiSettings.voice, speed: aiSettings.speed });
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
      }, 1200);
    }
  }, [aiConversation, aiSettings, roomLanguage, activeYoutubeId, showYoutube, roomId, userId, socket, addDebug, interruptAi]);

  // ── Toggle AI Tutor session ───────────────────────────────────────────────
  const toggleAiTutor = useCallback(() => {
    if (!aiActive) {
      socket?.emit("room:ai-tutor-start", { roomId, userId, username });
      setAiActive(true);
      setAiChatPanelOpen(false);
      chatPanelOpenRef.current = false;
      setAiConversation([]);
      setAiDebugLog([]);
      setAiLastBroadcast(null);
      const intro = INTRO_TEXTS[Math.floor(Math.random() * INTRO_TEXTS.length)];
      const introMsg: ConversationEntry = { id: `a-intro-${Date.now()}`, role: "ai", text: intro };
      setAiConversation([introMsg]);
      setTimeout(() => ttsRef.current?.enqueue(intro), 300);
    } else {
      // Stop session
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
    }
  }, [aiActive, socket, roomId, userId, username]);

  // ── Observe AI message from another user in the room ─────────────────────
  const observeSpeakText = useCallback((text: string, voice: string, speed: number) => {
    const engine = new TtsEngine({
      onStart: () => setCurrentViseme("open"),
      onEnd: () => setCurrentViseme("rest"),
      onSentenceEnd: () => {},
      onViseme: shape => setCurrentViseme(shape),
    });
    engine.configure(voice as "Female" | "Male", speed);
    engine.enqueue(text);
  }, []);

  // ── Start listening after AI active toggle ────────────────────────────────
  useEffect(() => {
    if (aiActive) {
      activeRef.current = true;
      setTimeout(() => {
        if (activeRef.current && !speakingRef.current) sttRef.current?.startListening();
      }, 1500);
    } else {
      activeRef.current = false;
      sttRef.current?.stopAll();
    }
  }, [aiActive]);

  // ── Socket event handlers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onState = (data: { active: boolean; userId: string | null; username: string | null; speaking: boolean }) => {
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
      voice?: string; speed?: number;
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
      observeSpeakText(data.text, data.voice || "Female", data.speed || 0.7);
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
  };

  const mediaState: MediaState = {
    youtubeActive: !!activeYoutubeId && showYoutube,
    youtubeId: activeYoutubeId,
  };

  const clearDebugLog = useCallback(() => setAiDebugLog([]), []);
  const setRoomAiTutorEnabled = useCallback((val: boolean) => setAiRoomEnabled(val), []);

  return {
    // State containers (as per spec)
    aiState,
    voiceState,
    mediaState,

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
    sendAiMessage,
    interruptAi,
    addDebug,
  };
}
