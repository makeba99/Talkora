/**
 * Stream Module — SSE streaming client for the AI LLM.
 * Connects to /api/ai-tutor/stream and yields tokens as they arrive.
 * Falls back to /api/ai-tutor/chat (buffered) if streaming fails.
 */

import type { AiTutorSettings, ConversationEntry } from "./types";

export interface StreamOptions {
  message: string;
  history: ConversationEntry[];
  settings: AiTutorSettings;
  language: string;
  youtubeActive: boolean;
  signal: AbortSignal;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onMeta: (event: string) => void;
  onDone: (model: string, latencyMs: number) => void;
  onError: (message: string) => void;
}

export interface FallbackResult {
  reply: string;
  correction?: string | null;
  correctionFixed?: string | null;
  model?: string;
}

/** Stream tokens from the SSE endpoint. Returns true if any tokens were received. */
export async function streamTokens(
  options: StreamOptions,
  callbacks: StreamCallbacks
): Promise<boolean> {
  const t0 = Date.now();
  let gotTokens = false;

  const res = await fetch("/api/ai-tutor/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: options.message,
      history: options.history.slice(-8),
      settings: options.settings,
      language: options.language,
      youtubeActive: options.youtubeActive,
    }),
    signal: options.signal,
  });

  if (!res.ok || !res.body) {
    callbacks.onError(`HTTP ${res.status}`);
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split("\n");
    sseBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      try {
        const event = JSON.parse(raw);

        if (event.error) {
          callbacks.onError(event.error);
          break;
        }

        if (event.meta) {
          callbacks.onMeta(event.meta);
        }

        if (event.token) {
          gotTokens = true;
          callbacks.onToken(event.token);
        }

        if (event.done) {
          callbacks.onDone(event.model || "unknown", Date.now() - t0);
        }
      } catch {}
    }
  }

  return gotTokens;
}

/** Buffered fallback — returns the full reply at once. */
export async function fetchBufferedReply(
  options: Omit<StreamOptions, "signal">
): Promise<FallbackResult | null> {
  try {
    const res = await fetch("/api/ai-tutor/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: options.message,
        history: options.history.slice(-8),
        settings: options.settings,
        language: options.language,
        youtubeActive: options.youtubeActive,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      reply: data.reply || "",
      correction: data.correction || null,
      correctionFixed: data.correctionFixed || null,
      model: data.debug?.model,
    };
  } catch {
    return null;
  }
}
