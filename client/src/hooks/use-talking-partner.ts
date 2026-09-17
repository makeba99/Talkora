/**
 * Dedicated 1:1 Talking Partner session (no room WebRTC / wake word).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudSttEngine } from "@/lib/ai-tutor/cloud-stt";
import { EvaTtsEngine } from "@/lib/ai-tutor/eva-tts";
import { fetchBufferedReply } from "@/lib/ai-tutor/stream";
import type { ConversationEntry, VoicePersona } from "@/lib/ai-tutor/types";
import type { TalkingPartner } from "@shared/talking-partners";

export type TalkState = "ready" | "listening" | "thinking" | "speaking";

export function userFacingTalkError(raw: string | null | undefined): string {
  const msg = String(raw || "").toLowerCase();
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.includes("notallowed") || msg.includes("permission denied") || msg.includes("microphone access")) {
    return "Microphone access is required to talk with your AI partner.";
  }
  if (msg.includes("microphone") || msg.includes("getusermedia") || msg.includes("notfound")) {
    return "Microphone access is required to talk with your AI partner.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("connection")) {
    return "Connection lost. Please try again.";
  }
  if (msg.includes("tts") || msg.includes("voice") || msg.includes("sesame") || msg.includes("speech")) {
    return "Your AI partner couldn't respond with voice. Please try again.";
  }
  if (msg.includes("stt") || msg.includes("transcrib")) {
    return "Couldn't hear that clearly. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export function useTalkingPartner(partner: TalkingPartner | null) {
  const [state, setState] = useState<TalkState>("ready");
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [interim, setInterim] = useState<string | null>(null);
  const [lastUserText, setLastUserText] = useState<string | null>(null);

  const conversationRef = useRef<ConversationEntry[]>([]);
  const stateRef = useRef<TalkState>("ready");
  const sttRef = useRef<CloudSttEngine | null>(null);
  const ttsRef = useRef<EvaTtsEngine | null>(null);
  const turnAbortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const resetToReady = useCallback((err?: string | null) => {
    inFlightRef.current = false;
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    ttsRef.current?.cancel();
    sttRef.current?.stop();
    setInterim(null);
    setState("ready");
    if (err) setError(userFacingTalkError(err));
  }, []);

  const speakReply = useCallback(async (text: string, voice: VoicePersona) => {
    if (!ttsRef.current) {
      ttsRef.current = new EvaTtsEngine({
        onStart: () => setState("speaking"),
        onEnd: () => {
          if (stateRef.current === "speaking") setState("ready");
        },
        onSentenceEnd: () => {},
      });
    }
    ttsRef.current.configure(voice, 1, null, "sesame");
    setState("speaking");
    ttsRef.current.enqueue(text);
  }, []);

  const runTurn = useCallback(
    async (userText: string) => {
      if (!partner) return;
      const trimmed = userText.trim();
      if (!trimmed || inFlightRef.current) return;
      inFlightRef.current = true;
      sttRef.current?.stop();
      setInterim(null);
      setLastUserText(trimmed);
      setError(null);

      const userEntry: ConversationEntry = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      };
      const history = [...conversationRef.current, userEntry];
      setConversation(history);
      setState("thinking");

      turnAbortRef.current?.abort();
      const abort = new AbortController();
      turnAbortRef.current = abort;
      const watchdog = setTimeout(() => abort.abort(), 45_000);

      try {
        const result = await fetchBufferedReply({
          roomId: "",
          message: trimmed,
          history: history.slice(-12),
          settings: {
            correctionMode: "live",
            teachingStyle: "Conversation",
            personality: "Friendly",
            voice: partner.gender,
            avatarId: partner.id,
            speed: 0.7,
            tone: 0.7,
            wakeWordEnabled: false,
            personaName: partner.name,
            partnerId: partner.id,
            talkingPartner: true,
          },
          language: "English",
          youtubeActive: false,
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        if (!result || result.error || !result.reply) {
          const err = result?.error || "AI is unavailable right now.";
          resetToReady(err);
          return;
        }
        const aiEntry: ConversationEntry = {
          id: `a-${Date.now()}`,
          role: "ai",
          text: result.reply,
          correction: result.correction || undefined,
          correctionFixed: result.correctionFixed || undefined,
        };
        setConversation((prev) => [...prev, aiEntry]);
        await speakReply(result.reply, partner.gender);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          resetToReady();
          return;
        }
        resetToReady(err?.message || "network");
      } finally {
        clearTimeout(watchdog);
        inFlightRef.current = false;
      }
    },
    [partner, resetToReady, speakReply],
  );

  const startListening = useCallback(async () => {
    if (!partner) return;
    setError(null);
    ttsRef.current?.cancel();
    if (stateRef.current === "speaking") {
      setState("ready");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is required to talk with your AI partner.");
      setState("ready");
      return;
    }

    const engine = new CloudSttEngine(
      {
        onSpeechStart: () => setInterim("…"),
        onTranscript: (text) => {
          setInterim(null);
          void runTurn(text);
        },
        onNotice: (m) => {
          if (/denied|permission|unavailable/i.test(m)) {
            resetToReady(m);
          }
        },
        onUnavailable: (reason) => resetToReady(reason),
      },
      { maxRequestsPerMinute: 30, minSpeechMs: 280, maxSpeechMs: 12000, overflow: "firstOnly" },
    );
    engine.setLanguage("English");
    sttRef.current?.stop();
    sttRef.current = engine;
    setState("listening");
    const ok = await engine.start(null, { allowOwnMic: true });
    if (!ok) {
      resetToReady("microphone permission denied");
    }
  }, [partner, resetToReady, runTurn]);

  const stopListening = useCallback(() => {
    sttRef.current?.stop();
    setInterim(null);
    if (stateRef.current === "listening") setState("ready");
  }, []);

  const interrupt = useCallback(() => {
    turnAbortRef.current?.abort();
    ttsRef.current?.cancel();
    sttRef.current?.stop();
    inFlightRef.current = false;
    setInterim(null);
    setState("ready");
  }, []);

  const toggleMic = useCallback(() => {
    if (stateRef.current === "listening") {
      stopListening();
      return;
    }
    if (stateRef.current === "speaking" || stateRef.current === "thinking") {
      interrupt();
      void startListening();
      return;
    }
    void startListening();
  }, [interrupt, startListening, stopListening]);

  useEffect(() => {
    return () => {
      turnAbortRef.current?.abort();
      ttsRef.current?.cancel();
      sttRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    setConversation([]);
    interrupt();
  }, [partner?.id]);

  return {
    state,
    error,
    conversation,
    interim,
    lastUserText,
    toggleMic,
    interrupt,
    stopListening,
    dismissError: () => setError(null),
  };
}
