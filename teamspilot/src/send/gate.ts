import { randomUUID } from "node:crypto";
import { sha256 } from "../core/hash.js";
import type { DraftStore } from "../core/store.js";
import type { Draft } from "../core/types.js";
import { UNCERTAIN_DETAIL, type DeliverResult, type MessageSender } from "./sender.js";

export interface DestinationCheck {
  verifyDestination(chatId: string): Promise<{ ok: true; label: string } | { ok: false; reason: string }>;
  canSend(): boolean;
}

export type GateResult =
  | { ok: true; status: "sent"; providerMessageId: string }
  | { ok: false; status: "uncertain" | "needs_review" | "failed"; error: string };

const BLOCKED = "This draft cannot be sent. Review it and try again only if you still want that exact text to go out.";

export class ApprovalGate {
  constructor(
    private readonly store: DraftStore,
    private readonly sender: MessageSender,
    private readonly destination: DestinationCheck,
    private readonly log: (level: "info" | "error", event: string, fields?: { draftId?: string; chatId?: string; detail?: string; outcome?: string }) => void = () => undefined,
  ) {}

  /** Creates an approval for this draft only. Does not send. */
  issueApproval(draftId: string, text: string): { ok: true; approvalId: string } | { ok: false; error: string } {
    const draft = this.store.get(draftId);
    const reason = draft ? approvalBlock(draft, text) : "Draft not found.";
    if (!draft || reason) return { ok: false, error: reason || BLOCKED };
    const approval = {
      id: randomUUID(),
      draftId: draft.id,
      revision: draft.revision,
      text,
      textSha256: sha256(text),
      chatId: draft.chatId,
      sourceMessageId: draft.sourceMessageId,
      createdAt: new Date().toISOString(),
      consumed: false,
      outcome: "pending" as const,
    };
    this.store.update(draft.id, { approval });
    return { ok: true, approvalId: approval.id };
  }

  /**
   * Sends only when the supplied approval still matches this draft's exact text,
   * revision, chat, and source message. A previous approval cannot be reused.
   */
  async execute(draftId: string, approvalId: string): Promise<GateResult> {
    return this.store.withLock(draftId, async () => {
      const draft = this.store.get(draftId);
      if (!draft?.approval || draft.approval.id !== approvalId || draft.approval.draftId !== draftId) {
        return this.blocked(draftId, draft?.chatId, "That approval does not belong to this draft.");
      }
      const approval = draft.approval;
      if (approval.consumed || approval.outcome !== "pending") {
        return this.blocked(draftId, draft.chatId, "That approval was already used and cannot authorize another send.");
      }
      if (approval.text !== draft.currentReply || approval.textSha256 !== sha256(draft.currentReply)) {
        return this.cancel(draft, "The draft text changed after approval.");
      }
      if (approval.revision !== draft.revision) return this.cancel(draft, "The draft was edited after approval.");
      if (approval.chatId !== draft.chatId || approval.sourceMessageId !== draft.sourceMessageId) {
        return this.cancel(draft, "The draft destination changed after approval.");
      }
      const blocked = approvalBlock(draft, approval.text);
      if (blocked) return this.cancel(draft, blocked);
      if (!draft.chatId || !this.destination.canSend()) {
        return this.cancel(draft, "Teams sending is unavailable, so this draft stays in draft-only mode.");
      }
      const verified = await this.destination.verifyDestination(draft.chatId);
      const fresh = this.store.get(draftId);
      if (!fresh || fresh.approval?.id !== approvalId || fresh.currentReply !== approval.text || fresh.revision !== approval.revision) {
        return this.cancel(draft, "The draft changed while the destination was being checked.");
      }
      if (!verified.ok || verified.label == null) {
        return this.cancel(draft, verified.ok ? "The destination could not be verified." : verified.reason);
      }
      const started = this.store.beginSend(draftId);
      if (!started) return this.cancel(draft, "The draft is no longer waiting for approval.");
      this.store.update(draftId, {
        approval: { ...approval, consumed: true },
        chatLabel: verified.label || draft.chatLabel,
      });
      let result: DeliverResult;
      try {
        result = await this.sender.deliver({ draftId, chatId: draft.chatId, text: approval.text });
      } catch {
        this.store.markUncertain(draftId, UNCERTAIN_DETAIL);
        this.log("error", "send_uncertain", { draftId, chatId: draft.chatId, outcome: "uncertain" });
        return { ok: false, status: "uncertain", error: UNCERTAIN_DETAIL };
      }
      if (result.outcome === "sent") {
        if (result.acceptedText !== approval.text || result.acceptedChatId !== draft.chatId || !result.providerMessageId) {
          const error = "The integration did not confirm this exact text and destination. Check Teams. TeamsPilot will not retry automatically.";
          this.store.markUncertain(draftId, error);
          this.log("error", "send_uncertain", { draftId, chatId: draft.chatId, outcome: "uncertain" });
          return { ok: false, status: "uncertain", error };
        }
        this.store.markDelivered(draftId, {
          kind: "graph",
          providerMessageId: result.providerMessageId,
          confirmedAt: new Date().toISOString(),
        });
        this.log("info", "send_confirmed", { draftId, chatId: draft.chatId, outcome: "sent" });
        return { ok: true, status: "sent", providerMessageId: result.providerMessageId };
      }
      if (result.outcome === "failed") {
        this.store.markFailed(draftId, result.detail);
        this.log("error", "send_rejected", { draftId, chatId: draft.chatId, outcome: "failed", detail: result.detail });
        return { ok: false, status: "failed", error: result.detail };
      }
      this.store.markUncertain(draftId, result.detail || UNCERTAIN_DETAIL);
      this.log("error", "send_uncertain", { draftId, chatId: draft.chatId, outcome: "uncertain" });
      return { ok: false, status: "uncertain", error: result.detail || UNCERTAIN_DETAIL };
    });
  }

  async approveAndSend(draftId: string, text: string): Promise<GateResult> {
    const issued = this.issueApproval(draftId, text);
    if (!issued.ok) return { ok: false, status: "needs_review", error: issued.error };
    return this.execute(draftId, issued.approvalId);
  }

  /** Records what a person found in Teams. Never calls the sender. */
  async resolveUncertain(draftId: string, resolution: "was_sent" | "not_sent"): Promise<GateResult> {
    return this.store.withLock(draftId, async () => {
      const draft = this.store.get(draftId);
      if (!draft || draft.status !== "uncertain") {
        return { ok: false, status: "needs_review", error: "Only an uncertain draft can be resolved this way." };
      }
      if (resolution === "was_sent") {
        this.store.markDelivered(draftId, { kind: "user", confirmedAt: new Date().toISOString() });
        this.log("info", "send_user_confirmed", { draftId, chatId: draft.chatId, outcome: "sent" });
        return { ok: true, status: "sent", providerMessageId: "user-confirmed" };
      }
      this.store.update(draftId, {
        status: "pending_review",
        error: null,
        approval: null,
      });
      this.log("info", "uncertain_cleared", { draftId, chatId: draft.chatId, outcome: "needs_review" });
      return { ok: false, status: "needs_review", error: "Recorded that the message was not in the chat. Nothing was sent. Approve again only if you want a new attempt." };
    });
  }

  private cancel(draft: Draft, error: string): GateResult {
    const approval = draft.approval ? { ...draft.approval, consumed: true, outcome: "cancelled" as const } : null;
    const status = draft.status === "editing" ? "editing" : draft.status === "failed" ? "failed" : "pending_review";
    if (draft.status !== "sending" && draft.status !== "sent" && draft.status !== "uncertain") {
      this.store.update(draft.id, { approval, error, status });
    }
    this.log("info", "send_blocked", { draftId: draft.id, chatId: draft.chatId, detail: error, outcome: "needs_review" });
    return { ok: false, status: "needs_review", error };
  }

  private blocked(draftId: string, chatId: string | undefined, error: string): GateResult {
    this.log("info", "send_blocked", { draftId, chatId, detail: error, outcome: "needs_review" });
    return { ok: false, status: "needs_review", error };
  }
}

function approvalBlock(draft: Draft, text: string): string | null {
  if (draft.status === "sent") return "This draft was already sent.";
  if (draft.status === "discarded") return "This draft was discarded, so it cannot be sent.";
  if (draft.status === "uncertain") {
    return "This send is uncertain. Check Teams and record what you found. TeamsPilot will not retry automatically.";
  }
  if (draft.status === "sending") return "A send is already in progress for this draft.";
  if (draft.status === "generating" || draft.status === "detected") return "The reply is not ready to send.";
  if (!["pending_review", "editing", "failed"].includes(draft.status)) return BLOCKED;
  if (text !== draft.currentReply) return "The text does not match the saved draft. Save the edit, then approve that exact text.";
  if (text.trim() === "") return "The reply is empty, so it was not sent.";
  return null;
}
