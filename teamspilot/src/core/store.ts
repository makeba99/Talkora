import { randomUUID } from "node:crypto";
import { contextFingerprint } from "./hash.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import type { ActivityEntry, AppState, ApprovalRecord, ChatCursor, DeliveryRecord, Draft, DraftStatus, Settings } from "./types.js";

export interface CreateDraftInput {
  sourceMessageId: string;
  chatId: string;
  chatLabel: string;
  senderId: string;
  senderLabel: string;
  originalMessage: string;
  source: "teams" | "manual";
}

export type DraftPatch = {
  chatLabel?: string;
  senderLabel?: string;
  context?: Draft["context"];
  contextFingerprint?: string;
  generatedReply?: string;
  currentReply?: string;
  revision?: number;
  generation?: number;
  status?: Exclude<DraftStatus, "sent" | "sending">;
  error?: string | null;
  approval?: ApprovalRecord | null;
  source?: Draft["source"];
};

const APPROVABLE = new Set<DraftStatus>(["pending_review", "editing", "failed"]);
const ACTIVITY_CAP = 400;
const PROCESSED_CAP = 5000;

export function emptyState(settings: Settings = DEFAULT_SETTINGS): AppState {
  return { version: 1, drafts: [], processedIds: [], cursors: {}, settings, activity: [] };
}

export class DraftStore {
  private locks = new Map<string, Promise<void>>();

  constructor(
    private state: AppState,
    private persist: (state: AppState) => void = () => undefined,
  ) {}

  snapshot(): AppState {
    return structuredClone(this.state);
  }

  list(): Draft[] {
    return this.state.drafts.map((draft) => structuredClone(draft));
  }

  get(id: string): Draft | null {
    const draft = this.state.drafts.find((item) => item.id === id);
    return draft ? structuredClone(draft) : null;
  }

  findBySource(sourceMessageId: string): Draft | null {
    const draft = this.state.drafts.find((item) => item.sourceMessageId === sourceMessageId);
    return draft ? structuredClone(draft) : null;
  }

  isProcessed(id: string): boolean {
    return this.state.processedIds.includes(id);
  }

  markProcessed(id: string): boolean {
    if (this.state.processedIds.includes(id)) return false;
    this.state.processedIds.push(id);
    if (this.state.processedIds.length > PROCESSED_CAP) {
      this.state.processedIds.splice(0, this.state.processedIds.length - PROCESSED_CAP);
    }
    this.save();
    return true;
  }

  unmarkProcessed(id: string): void {
    this.state.processedIds = this.state.processedIds.filter((item) => item !== id);
    this.save();
  }

  create(input: CreateDraftInput): Draft {
    if (this.state.drafts.some((draft) => draft.sourceMessageId === input.sourceMessageId)) {
      throw new Error("A draft already exists for this message.");
    }
    const now = new Date().toISOString();
    const draft: Draft = {
      id: randomUUID(),
      sourceMessageId: input.sourceMessageId,
      chatId: input.chatId,
      chatLabel: input.chatLabel,
      senderId: input.senderId,
      senderLabel: input.senderLabel,
      originalMessage: input.originalMessage,
      context: [],
      contextFingerprint: contextFingerprint(input.sourceMessageId, []),
      generatedReply: "",
      currentReply: "",
      revision: 1,
      generation: 1,
      createdAt: now,
      updatedAt: now,
      status: "detected",
      source: input.source,
    };
    this.state.drafts.push(draft);
    this.save();
    return structuredClone(draft);
  }

  update(id: string, patch: DraftPatch): Draft {
    const draft = this.must(id);
    const requested = patch.status as string | undefined;
    if (requested === "sent" || requested === "sending") {
      throw new Error("That status can only be set by the send gate.");
    }
    if (patch.chatLabel !== undefined) draft.chatLabel = patch.chatLabel;
    if (patch.senderLabel !== undefined) draft.senderLabel = patch.senderLabel;
    if (patch.context !== undefined) draft.context = patch.context;
    if (patch.contextFingerprint !== undefined) draft.contextFingerprint = patch.contextFingerprint;
    if (patch.generatedReply !== undefined) draft.generatedReply = patch.generatedReply;
    if (patch.currentReply !== undefined) draft.currentReply = patch.currentReply;
    if (patch.revision !== undefined) draft.revision = patch.revision;
    if (patch.generation !== undefined) draft.generation = patch.generation;
    if (patch.status !== undefined) draft.status = patch.status;
    if ("error" in patch) draft.error = patch.error ?? undefined;
    if ("approval" in patch) draft.approval = patch.approval ?? undefined;
    draft.updatedAt = new Date().toISOString();
    this.save();
    return structuredClone(draft);
  }

  beginSend(id: string): Draft | null {
    const draft = this.must(id);
    if (!APPROVABLE.has(draft.status)) return null;
    draft.status = "sending";
    draft.updatedAt = new Date().toISOString();
    this.save();
    return structuredClone(draft);
  }

  markDelivered(id: string, delivery: DeliveryRecord): Draft {
    const draft = this.must(id);
    if (delivery.kind === "graph" && draft.status !== "sending") {
      throw new Error("Refusing to mark a draft sent without an in-progress send.");
    }
    if (delivery.kind === "user" && draft.status !== "uncertain") {
      throw new Error("Refusing to mark a draft sent without your verification of an uncertain send.");
    }
    draft.status = "sent";
    draft.delivery = delivery;
    draft.error = undefined;
    draft.updatedAt = new Date().toISOString();
    this.save();
    return structuredClone(draft);
  }

  markUncertain(id: string, error: string): Draft {
    const draft = this.must(id);
    draft.status = "uncertain";
    draft.error = error;
    if (draft.approval) draft.approval.outcome = "uncertain";
    draft.updatedAt = new Date().toISOString();
    this.save();
    return structuredClone(draft);
  }

  markFailed(id: string, error: string): Draft {
    const draft = this.must(id);
    draft.status = "failed";
    draft.error = error;
    if (draft.approval && draft.approval.outcome === "pending") draft.approval.outcome = "failed";
    draft.updatedAt = new Date().toISOString();
    this.save();
    return structuredClone(draft);
  }

  getSettings(): Settings {
    return structuredClone(this.state.settings);
  }

  saveSettings(settings: Settings): Settings {
    this.state.settings = structuredClone(settings);
    this.save();
    return this.getSettings();
  }

  cursor(chatId: string): ChatCursor {
    return (
      this.state.cursors[chatId] ?? {
        primed: false,
        watermark: new Date(0).toISOString(),
        backlogPath: null,
      }
    );
  }

  saveCursor(chatId: string, cursor: ChatCursor): void {
    this.state.cursors[chatId] = cursor;
    this.save();
  }

  addActivity(entry: ActivityEntry): void {
    this.state.activity.push(entry);
    if (this.state.activity.length > ACTIVITY_CAP) {
      this.state.activity.splice(0, this.state.activity.length - ACTIVITY_CAP);
    }
    this.save();
  }

  activity(): ActivityEntry[] {
    return structuredClone(this.state.activity);
  }

  sensitiveSnippets(): string[] {
    const snippets: string[] = [];
    for (const draft of this.state.drafts) {
      snippets.push(draft.originalMessage, draft.generatedReply, draft.currentReply);
      for (const turn of draft.context) snippets.push(turn.text);
    }
    return snippets.filter((snippet) => snippet.length >= 12);
  }

  clearConversationData(): void {
    this.state.drafts = [];
    this.state.processedIds = [];
    this.state.cursors = {};
    this.state.activity = [];
    this.save();
  }

  async withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      id,
      previous.then(() => gate),
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(id) === gate) this.locks.delete(id);
    }
  }

  private must(id: string): Draft {
    const draft = this.state.drafts.find((item) => item.id === id);
    if (!draft) throw new Error("Draft not found.");
    return draft;
  }

  private save(): void {
    this.persist(this.state);
  }
}
