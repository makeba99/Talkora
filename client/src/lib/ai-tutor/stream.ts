/**
 * Stream Module — SSE streaming client for the AI LLM.
 * Connects to /api/ai-tutor/stream and yields tokens as they arrive.
 * Falls back to /api/ai-tutor/chat (buffered) if streaming fails.
 */

import type { AiTutorSettings, ConversationEntry } from "./types";

export interface StreamOptions {
  roomId: string;
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

  // ── First-byte timeout ───────────────────────────────────────────────────
  // If the server hasn't sent any data within 6s of the connection opening,
  // treat it as a hung connection and abort so the hook can fall back to the
  // buffered endpoint. Without this, a silent server-side hang would leave
  // the UI in a permanent loading state.
  const firstByteController = new AbortController();
  const firstByteTimer = setTimeout(() => {
    if (!gotTokens) {
      firstByteController.abort();
      callbacks.onError("first-byte timeout");
    }
  }, 6000);

  // Merge caller's abort signal with our first-byte timeout signal
  const combinedSignal = AbortSignal.any
    ? AbortSignal.any([options.signal, firstByteController.signal])
    : options.signal; // fallback for browsers without AbortSignal.any

  let res: Response;
  try {
    res = await fetch("/api/ai-tutor/stream", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: options.roomId,
        message: options.message,
        history: options.history.slice(-8),
        settings: options.settings,
        language: options.language,
        youtubeActive: options.youtubeActive,
      }),
      signal: combinedSignal,
    });
  } catch (err: any) {
    clearTimeout(firstByteTimer);
    if (err?.name !== "AbortError") callbacks.onError(err?.message || "fetch failed");
    return false;
  }

  clearTimeout(firstByteTimer);

  if (!res.ok || !res.body) {
    const statusMsg =
      res.status === 429 ? "rate limited — try again in a moment"
      : res.status === 503 ? "AI service temporarily unavailable"
      : res.status >= 500 ? `server error (${res.status})`
      : `HTTP ${res.status}`;
    callbacks.onError(statusMsg);
    return false;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";

  // ── Per-chunk timeout ────────────────────────────────────────────────────
  // After the first token arrives, reset a 10s watchdog on each chunk.
  // A long mid-stream pause (stuck generation) causes the watchdog to fire
  // so the hook can gracefully stop and show what was received so far.
  let chunkTimer: ReturnType<typeof setTimeout> | null = null;
  const resetChunkTimer = () => {
    if (chunkTimer) clearTimeout(chunkTimer);
    chunkTimer = setTimeout(() => {
      callbacks.onError("stream stalled");
      try { reader.cancel(); } catch {}
    }, 10_000);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (gotTokens) resetChunkTimer();

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
            if (chunkTimer) clearTimeout(chunkTimer);
            callbacks.onDone(event.model || "unknown", Date.now() - t0);
          }
        } catch {}
      }
    }
  } finally {
    if (chunkTimer) clearTimeout(chunkTimer);
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
        roomId: options.roomId,
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
