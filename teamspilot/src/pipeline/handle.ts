import { contextFingerprint } from "../core/hash.js";
import { cap, isolateContext } from "../core/context.js";
import type { DraftPatch, DraftStore } from "../core/store.js";
import type { Draft, NormalizedMessage, Settings } from "../core/types.js";
import { AiConfigError, type AiProvider } from "../ai/provider.js";
import type { ReplyRequest } from "../ai/prompt.js";

export interface PipelineStore {
  markProcessed(id: string): boolean;
  unmarkProcessed(id: string): void;
  findBySource(id: string): Draft | null;
  create(input: Parameters<DraftStore["create"]>[0]): Draft;
  update(id: string, patch: DraftPatch): Draft;
  get(id: string): Draft | null;
  withLock<T>(id: string, fn: () => Promise<T>): Promise<T>;
}

export interface ContextSource {
  readContext(chatId: string): Promise<NormalizedMessage[]>;
}

export interface PipelineLogger {
  info(event: string, fields?: { draftId?: string; chatId?: string; detail?: string; status?: string; count?: number }): void;
  error(event: string, fields?: { draftId?: string; chatId?: string; detail?: string; status?: string }): void;
}

export interface DraftNotifier {
  draftReady(info: { draftId: string; chatLabel: string; senderLabel: string }): void;
  changed(): void;
}

const STALE = "The conversation changed while the reply was being written, so the suggestion was discarded. Nothing was sent. Regenerate if you still want one.";
const STOPPED = "Monitoring stopped before the reply was finished. Nothing was sent. Regenerate if you still want a suggestion.";

export class DraftPipeline {
  private controllers = new Set<AbortController>();

  constructor(
    private readonly deps: {
      store: PipelineStore;
      ai: AiProvider;
      context: ContextSource;
      settings: () => Settings;
      selfId: () => string | null;
      log: PipelineLogger;
      notify: DraftNotifier;
    },
  ) {}

  cancelAll(): void {
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  async handleIncoming(message: NormalizedMessage, source: "teams" | "manual" = "teams", chatLabel = ""): Promise<Draft | null> {
    const selfId = this.deps.selfId();
    if (source === "teams" && selfId && message.senderId === selfId) {
      this.deps.store.markProcessed(message.id);
      this.deps.log.info("ignored_own_message", { chatId: message.chatId });
      return null;
    }
    if (message.mine && source === "teams") {
      this.deps.store.markProcessed(message.id);
      return null;
    }
    const existing = this.deps.store.findBySource(message.id);
    if (existing) return existing;
    if (!this.deps.store.markProcessed(message.id)) return this.deps.store.findBySource(message.id);
    let draft: Draft;
    try {
      draft = this.deps.store.create({
        sourceMessageId: message.id,
        chatId: message.chatId,
        chatLabel: chatLabel || (message.chatId ? "Selected chat" : "No Teams chat"),
        senderId: message.senderId,
        senderLabel: message.senderLabel,
        originalMessage: cap(message.text, 8000),
        source,
      });
    } catch (error) {
      this.deps.store.unmarkProcessed(message.id);
      throw error;
    }
    this.deps.log.info("message_detected", {
      draftId: draft.id,
      chatId: draft.chatId,
      status: "detected",
      detail: this.deps.settings().logMessageContent ? cap(message.text, 120) : undefined,
    });
    return this.generate(draft.id, message, draft.generation);
  }

  async regenerate(draftId: string): Promise<Draft> {
    const current = await this.deps.store.withLock(draftId, async () => {
      const draft = this.deps.store.get(draftId);
      if (!draft) throw new Error("Draft not found.");
      if (["discarded", "sent", "sending", "uncertain"].includes(draft.status)) {
        throw new Error("This draft cannot be regenerated.");
      }
      return this.deps.store.update(draftId, {
        status: "generating",
        generation: draft.generation + 1,
        revision: draft.revision + 1,
        approval: null,
        currentReply: "",
        generatedReply: "",
        error: null,
      });
    });
    const message: NormalizedMessage = {
      id: current.sourceMessageId,
      idSource: current.source === "manual" ? "manual" : "graph",
      chatId: current.chatId,
      senderId: current.senderId,
      senderLabel: current.senderLabel,
      text: current.originalMessage,
      createdAt: current.createdAt,
      mine: false,
    };
    this.deps.log.info("regenerate_started", { draftId, chatId: current.chatId, status: "generating" });
    return (await this.generate(draftId, message, current.generation)) ?? current;
  }

  async edit(draftId: string, text: string): Promise<Draft> {
    return this.deps.store.withLock(draftId, async () => {
      const draft = this.deps.store.get(draftId);
      if (!draft) throw new Error("Draft not found.");
      if (!["pending_review", "editing", "failed"].includes(draft.status)) {
        throw new Error("This draft cannot be edited right now.");
      }
      return this.deps.store.update(draftId, {
        currentReply: text,
        status: "editing",
        revision: draft.revision + 1,
        approval: null,
        error: null,
      });
    });
  }

  async discard(draftId: string): Promise<Draft> {
    return this.deps.store.withLock(draftId, async () => {
      const draft = this.deps.store.get(draftId);
      if (!draft) throw new Error("Draft not found.");
      if (draft.status === "sending" || draft.status === "sent") throw new Error("This draft can no longer be discarded.");
      return this.deps.store.update(draftId, { status: "discarded", approval: null });
    });
  }

  private async generate(draftId: string, message: NormalizedMessage, generation: number): Promise<Draft | null> {
    const controller = new AbortController();
    this.controllers.add(controller);
    this.deps.store.update(draftId, { status: "generating" });
    try {
      const context = await this.readIsolated(message);
      const fingerprint = contextFingerprint(message.id, context);
      const settings = this.deps.settings();
      const request: ReplyRequest = {
        model: settings.model,
        style: settings.style,
        languageMode: settings.languageMode,
        fixedLanguage: settings.fixedLanguage,
        chatLabel: this.deps.store.get(draftId)?.chatLabel || message.senderLabel,
        incoming: message,
        context,
      };
      this.deps.store.update(draftId, { context, contextFingerprint: fingerprint, status: "generating" });
      const reply = await this.deps.ai.generateReply(request, controller.signal);
      if (controller.signal.aborted) return this.failIfCurrent(draftId, generation, STOPPED);
      const again = await this.readIsolated(message);
      const againFingerprint = contextFingerprint(message.id, again);
      const current = this.deps.store.get(draftId);
      if (!current || current.generation !== generation) return current;
      if (current.chatId !== message.chatId) {
        return this.failIfCurrent(draftId, generation, "The draft stayed bound to its original chat, but the binding check failed. Nothing was sent.");
      }
      if (againFingerprint !== fingerprint) return this.failIfCurrent(draftId, generation, STALE);
      const saved = this.deps.store.update(draftId, {
        status: "pending_review",
        generatedReply: reply,
        currentReply: reply,
        context: again,
        contextFingerprint: againFingerprint,
        error: null,
      });
      this.deps.log.info("draft_ready", { draftId, chatId: saved.chatId, status: "pending_review" });
      this.deps.notify.draftReady({ draftId, chatLabel: saved.chatLabel, senderLabel: saved.senderLabel });
      return saved;
    } catch (error) {
      const detail = error instanceof AiConfigError ? error.message : "The reply could not be written. Nothing was sent.";
      return this.failIfCurrent(draftId, generation, detail);
    } finally {
      this.controllers.delete(controller);
      this.deps.notify.changed();
    }
  }

  private async readIsolated(message: NormalizedMessage): Promise<NormalizedMessage[]> {
    if (!message.chatId) return [];
    const raw = await this.deps.context.readContext(message.chatId);
    return isolateContext(raw, message.chatId, message.id);
  }

  private failIfCurrent(draftId: string, generation: number, error: string): Draft | null {
    const current = this.deps.store.get(draftId);
    if (!current || current.generation !== generation) return current;
    const failed = this.deps.store.update(draftId, {
      status: "failed",
      error,
      generatedReply: "",
      currentReply: "",
    });
    this.deps.log.error("draft_failed", { draftId, chatId: failed.chatId, status: "failed", detail: error });
    return failed;
  }
}
