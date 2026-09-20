import type { Database } from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { generateReply, qualityCheck } from "../ai/reply-engine.ts";
import { openaiConfig as readOpenAi } from "../security/index.ts";
import type { PlatformConnector, NormalizedMessage } from "../connectors/platform-connector.ts";
import { IntegrationUnavailable } from "../connectors/platform-connector.ts";
import { getSettings } from "../database/index.ts";
import { logEvent } from "../logging/index.ts";

export { openaiConfig } from "../security/index.ts";

export type ConnectorMap = Record<string, PlatformConnector>;

function duplicateKey(platform: string, conversationId: string, sourceMessageId: string, body: string): string {
  return createHash("sha256").update(`${platform}|${conversationId}|${sourceMessageId}|${body}`).digest("hex");
}

export function checkRateLimit(db: Database, key: string, maxPerHour: number): { allowed: boolean; count: number } {
  const now = Date.now();
  const row = db.prepare(`SELECT window_start, count FROM rate_limits WHERE id = ?`).get(key) as
    | { window_start: string; count: number }
    | undefined;
  if (!row) {
    db.prepare(`INSERT INTO rate_limits (id, window_start, count) VALUES (?, ?, 0)`).run(key, new Date(now).toISOString());
    return { allowed: true, count: 0 };
  }
  const start = Date.parse(row.window_start);
  if (now - start >= 60 * 60 * 1000) {
    db.prepare(`UPDATE rate_limits SET window_start = ?, count = 0 WHERE id = ?`).run(new Date(now).toISOString(), key);
    return { allowed: true, count: 0 };
  }
  return { allowed: row.count < maxPerHour, count: row.count };
}

export function bumpRateLimit(db: Database, key: string): void {
  db.prepare(`UPDATE rate_limits SET count = count + 1 WHERE id = ?`).run(key);
}

export class AgentRuntime {
  private f4tUnsub: (() => void) | null = null;

  constructor(
    private readonly db: Database,
    private readonly connectors: ConnectorMap,
    private readonly rootDir: string,
  ) {}

  emergencyStop(on: boolean) {
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE agent_settings SET emergency_stop = ?, updated_at = ? WHERE id = 'default'`).run(on ? 1 : 0, now);
    logEvent(this.db, {
      level: "warn",
      event: on ? "emergency_stop" : "emergency_resume",
      detail: { on },
    });
    return getSettings(this.db);
  }

  async setFree4TalkMonitoring(on: boolean): Promise<{ monitoring: boolean }> {
    const f4t = this.connectors.free4talk as
      | (PlatformConnector & {
          setMonitoring?: (value: boolean) => Promise<{ monitoring: boolean }>;
          getMonitoring?: () => boolean;
        })
      | undefined;
    if (!f4t?.setMonitoring) return { monitoring: false };
    await f4t.setMonitoring(on);
    if (on && !this.f4tUnsub) {
      this.f4tUnsub = await f4t.watchForNewMessages((msg) => {
        this.ingestVisibleMessage(msg).catch((err) => {
          logEvent(this.db, {
            level: "error",
            event: "f4t_live_ingest_failed",
            platform: "free4talk",
            detail: { message: err instanceof Error ? err.message : String(err) },
          });
        });
      });
    }
    if (!on && this.f4tUnsub) {
      this.f4tUnsub();
      this.f4tUnsub = null;
    }
    logEvent(this.db, { event: on ? "f4t_monitoring_on" : "f4t_monitoring_off", platform: "free4talk", detail: { on } });
    return { monitoring: on };
  }

  pausePlatform(platform: string, paused: boolean) {
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE platform_settings SET paused = ?, updated_at = ? WHERE platform = ?`).run(paused ? 1 : 0, now, platform);
    this.db.prepare(`UPDATE platform_connections SET paused = ?, updated_at = ? WHERE platform = ?`).run(paused ? 1 : 0, now, platform);
    logEvent(this.db, { event: paused ? "platform_paused" : "platform_resumed", platform, detail: { paused } });
  }

  async ingestVisibleMessage(msg: NormalizedMessage): Promise<"draft" | "sent" | "skip" | "dup"> {
    const convoId = this.upsertConversation(msg.platform, msg.conversationExternalId, msg.conversationTitle, msg.sentAt);
    if (msg.platform === "free4talk") {
      await this.snapshotVisibleRoom(msg.conversationExternalId, convoId);
    }
    if (msg.direction !== "inbound") {
      this.insertMessage(convoId, msg);
      return "skip";
    }
    this.insertMessage(convoId, msg);
    const row = this.db
      .prepare(
        `SELECT m.*, c.platform as convo_platform, c.title as convo_title, c.category, c.auto_enabled as convo_auto, c.paused as convo_paused, c.external_id as convo_external
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE m.platform = ? AND m.external_id = ?`,
      )
      .get(msg.platform, msg.externalId) as any;
    if (!row) return "skip";
    const already = this.db.prepare(`SELECT id FROM drafts WHERE source_message_id = ? LIMIT 1`).get(row.id);
    if (already) return "dup";
    return this.handleInbound(row, getSettings(this.db));
  }

  async ingestFromConnectors(): Promise<{ ingested: number; skipped: string[] }> {
    const skipped: string[] = [];
    let ingested = 0;
    for (const [platform, connector] of Object.entries(this.connectors)) {
      try {
        const status = await connector.getStatus();
        if (status.status !== "connected") {
          skipped.push(`${platform}: ${status.status}`);
          continue;
        }
        const convos = await connector.getConversations();
        for (const convo of convos) {
          const conversationId = this.upsertConversation(convo.platform, convo.externalId, convo.title, convo.lastMessageAt);
          let messages: NormalizedMessage[] = [];
          try {
            messages = await connector.getMessages(convo.externalId);
          } catch (error) {
            if (error instanceof IntegrationUnavailable) {
              skipped.push(`${platform}: ${error.message}`);
              break;
            }
            throw error;
          }
          for (const msg of messages) {
            if (this.insertMessage(conversationId, msg)) ingested += 1;
          }
        }
      } catch (error) {
        if (error instanceof IntegrationUnavailable) {
          skipped.push(`${platform}: integration unavailable`);
          logEvent(this.db, {
            level: "warn",
            event: "integration_unavailable",
            platform,
            detail: error.toJSON(),
          });
          continue;
        }
        const message = error instanceof Error ? error.message : String(error);
        skipped.push(`${platform}: ${message}`);
        logEvent(this.db, { level: "error", event: "ingest_failed", platform, detail: { message } });
      }
    }
    return { ingested, skipped };
  }

  async processInbox(): Promise<{ drafts: number; sent: number; skipped: number }> {
    const settings = getSettings(this.db);
    let drafts = 0;
    let sent = 0;
    let skipped = 0;
    if (settings.emergencyStop) {
      logEvent(this.db, { event: "tick_blocked_emergency", detail: {} });
      return { drafts: 0, sent: 0, skipped: 0 };
    }
    const inbound = this.db
      .prepare(
        `SELECT m.*, c.platform as convo_platform, c.title as convo_title, c.category, c.auto_enabled as convo_auto, c.paused as convo_paused, c.external_id as convo_external
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE m.direction = 'inbound'
         ORDER BY m.sent_at DESC
         LIMIT 50`,
      )
      .all() as any[];

    for (const msg of inbound) {
      const already = this.db
        .prepare(`SELECT id FROM drafts WHERE source_message_id = ? LIMIT 1`)
        .get(msg.id);
      if (already) continue;
      const result = await this.handleInbound(msg, settings);
      if (result === "draft") drafts += 1;
      else if (result === "sent") sent += 1;
      else skipped += 1;
    }
    return { drafts, sent, skipped };
  }

  async approveDraft(draftId: string): Promise<unknown> {
    const draft = this.db.prepare(`SELECT * FROM drafts WHERE id = ?`).get(draftId) as any;
    if (!draft) throw new Error("Draft not found");
    if (draft.status !== "pending") throw new Error(`Draft is ${draft.status}`);
    return this.dispatchDraft(draft, { approved: true });
  }

  async rejectDraft(draftId: string): Promise<void> {
    this.db.prepare(`UPDATE drafts SET status = 'rejected', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), draftId);
    logEvent(this.db, { event: "draft_rejected", conversationId: undefined, detail: { draftId } });
  }

  async editDraft(draftId: string, body: string): Promise<void> {
    this.db.prepare(`UPDATE drafts SET body = ?, updated_at = ? WHERE id = ?`).run(body, new Date().toISOString(), draftId);
  }

  private async handleInbound(msg: any, settings: ReturnType<typeof getSettings>): Promise<"draft" | "sent" | "skip"> {
    if (settings.emergencyStop) {
      logEvent(this.db, { event: "tick_blocked_emergency", platform: msg.platform, conversationId: msg.conversation_id, detail: {} });
    }
    const platformPaused = this.db.prepare(`SELECT paused, auto_enabled, max_replies_per_hour FROM platform_settings WHERE platform = ?`).get(msg.platform) as any;
    if (platformPaused?.paused || msg.convo_paused) {
      logEvent(this.db, { event: "skipped_paused", platform: msg.platform, conversationId: msg.conversation_id, detail: {} });
      return "skip";
    }
    const rateKey = `${msg.platform}:${msg.conversation_id}`;
    const limit = checkRateLimit(this.db, rateKey, platformPaused?.max_replies_per_hour ?? 10);
    if (!limit.allowed) {
      logEvent(this.db, { level: "warn", event: "rate_limited", platform: msg.platform, conversationId: msg.conversation_id, detail: { count: limit.count } });
      return "skip";
    }

    const history = this.db
      .prepare(`SELECT direction, sender_name, body, sent_at FROM messages WHERE conversation_id = ? ORDER BY sent_at ASC LIMIT 40`)
      .all(msg.conversation_id) as any[];
    const style = this.db.prepare(`SELECT examples, notes FROM style_profiles WHERE id = 'default'`).get() as any;
    const memory = this.db
      .prepare(`SELECT key, value FROM conversation_memory WHERE conversation_id = ? OR conversation_id IS NULL`)
      .all(msg.conversation_id) as any[];

    const generated = await generateReply(
      {
        platform: msg.platform,
        conversationTitle: msg.convo_title,
        conversationCategory: msg.category === "work" ? "work" : "personal",
        messages: history.map((h) => ({
          direction: h.direction,
          senderName: h.sender_name,
          body: h.body,
          sentAt: h.sent_at,
        })),
        styleExamples: JSON.parse(style?.examples || "[]"),
        styleNotes: style?.notes,
        memory,
        settings: { mode: settings.mode, simulationEnabled: settings.simulationEnabled },
      },
      readOpenAi(),
    );

    const quality = qualityCheck(generated.reply, msg.body);
    if (!quality.ok || generated.recommended_action === "skip" || !generated.reply) {
      logEvent(this.db, {
        event: "reply_skipped",
        platform: msg.platform,
        conversationId: msg.conversation_id,
        detail: { reason: generated.reason },
      });
      return "skip";
    }

    const now = new Date().toISOString();
    const draftId = randomUUID();
    this.db.prepare(
      `INSERT INTO drafts (id, conversation_id, platform, source_message_id, body, language, confidence, reason, recommended_action, status, created_at, updated_at)
       VALUES (@id, @conversation_id, @platform, @source_message_id, @body, @language, @confidence, @reason, @recommended_action, 'pending', @now, @now)`,
    ).run({
      id: draftId,
      conversation_id: msg.conversation_id,
      platform: msg.platform,
      source_message_id: msg.id,
      body: generated.reply,
      language: generated.language,
      confidence: generated.confidence,
      reason: generated.reason,
      recommended_action: generated.recommended_action,
      now,
    });
    logEvent(this.db, {
      event: "draft_created",
      platform: msg.platform,
      conversationId: msg.conversation_id,
      detail: { draftId, engine: generated.engine, language: generated.language },
    });

    if (settings.emergencyStop || platformPaused?.paused || msg.convo_paused) return "draft";

    const f4tLiveAuto =
      msg.platform === "free4talk" &&
      Boolean(platformPaused?.auto_enabled) &&
      !settings.simulationEnabled &&
      settings.liveSendEnabled;

    const autoOk =
      f4tLiveAuto ||
      (settings.mode === "auto" && Boolean(platformPaused?.auto_enabled) && Boolean(msg.convo_auto));
    if (settings.mode === "draft" && !f4tLiveAuto) return "draft";
    if (!autoOk) return "draft";

    const draft = this.db.prepare(`SELECT * FROM drafts WHERE id = ?`).get(draftId);
    await this.dispatchDraft(draft, { approved: false, auto: true });
    return "sent";
  }

  private async dispatchDraft(draft: any, flags: { approved: boolean; auto?: boolean }) {
    const settings = getSettings(this.db);
    if (settings.emergencyStop) throw new Error("Emergency stop is on");
    const convo = this.db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(draft.conversation_id) as any;
    const connector = this.connectors[draft.platform];
    if (!connector) throw new Error(`No connector for ${draft.platform}`);

    const fingerprint = duplicateKey(draft.platform, draft.conversation_id, draft.source_message_id || "", draft.body);
    const dup = this.db.prepare(`SELECT id FROM sent_messages WHERE id = ? AND error IS NULL`).get(fingerprint);
    if (dup) {
      this.db.prepare(`UPDATE drafts SET status = 'sent', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), draft.id);
      logEvent(this.db, { event: "duplicate_blocked", platform: draft.platform, conversationId: draft.conversation_id, detail: { draftId: draft.id } });
      return { duplicate: true };
    }

    const simulate = settings.simulationEnabled || !settings.liveSendEnabled;
    const now = new Date().toISOString();
    try {
      const result = await connector.sendMessage(convo.external_id, draft.body, { simulate });
      this.db.prepare(
        `INSERT INTO sent_messages (id, platform, conversation_id, draft_id, body, mode, simulated, external_id, error, created_at)
         VALUES (@id, @platform, @conversation_id, @draft_id, @body, @mode, @simulated, @external_id, NULL, @now)`,
      ).run({
        id: fingerprint,
        platform: draft.platform,
        conversation_id: draft.conversation_id,
        draft_id: draft.id,
        body: draft.body,
        mode: flags.auto ? "auto" : "approval",
        simulated: result.simulated ? 1 : 0,
        external_id: result.externalId || null,
        now,
      });
      this.db.prepare(`UPDATE drafts SET status = ?, updated_at = ? WHERE id = ?`).run(
        result.simulated ? "simulated" : "sent",
        now,
        draft.id,
      );
      bumpRateLimit(this.db, `${draft.platform}:${draft.conversation_id}`);
      logEvent(this.db, {
        event: result.simulated ? "simulated_send" : "live_send",
        platform: draft.platform,
        conversationId: draft.conversation_id,
        detail: { draftId: draft.id, simulated: result.simulated },
      });
      return result;
    } catch (error) {
      const message = error instanceof IntegrationUnavailable ? error.message : error instanceof Error ? error.message : String(error);
      this.db.prepare(
        `INSERT INTO sent_messages (id, platform, conversation_id, draft_id, body, mode, simulated, external_id, error, created_at)
         VALUES (@id, @platform, @conversation_id, @draft_id, @body, @mode, 0, NULL, @error, @now)`,
      ).run({
        id: randomUUID(),
        platform: draft.platform,
        conversation_id: draft.conversation_id,
        draft_id: draft.id,
        body: draft.body,
        mode: flags.auto ? "auto" : "approval",
        error: message,
        now,
      });
      this.db.prepare(`UPDATE drafts SET status = 'failed', updated_at = ? WHERE id = ?`).run(now, draft.id);
      logEvent(this.db, {
        level: "error",
        event: "send_failed",
        platform: draft.platform,
        conversationId: draft.conversation_id,
        detail: error instanceof IntegrationUnavailable ? error.toJSON() : { message },
      });
      throw error;
    }
  }

  private async snapshotVisibleRoom(roomId: string, convoId: string): Promise<void> {
    const connector = this.connectors.free4talk;
    if (!connector) return;
    try {
      const visible = await connector.getMessages(roomId);
      for (const m of visible) this.insertMessage(convoId, m);
    } catch (error) {
      if (error instanceof IntegrationUnavailable) return;
      throw error;
    }
  }

  upsertConversation(platform: string, externalId: string, title: string, lastMessageAt?: string): string {
    const existing = this.db
      .prepare(`SELECT id FROM conversations WHERE platform = ? AND external_id = ?`)
      .get(platform, externalId) as { id: string } | undefined;
    if (existing) {
      this.db.prepare(`UPDATE conversations SET title = ?, last_message_at = ? WHERE id = ?`).run(
        title,
        lastMessageAt || null,
        existing.id,
      );
      return existing.id;
    }
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO conversations (id, platform, external_id, title, category, last_message_at, unread, auto_enabled, paused)
       VALUES (?, ?, ?, ?, 'personal', ?, 0, 0, 0)`,
    ).run(id, platform, externalId, title, lastMessageAt || null);
    return id;
  }

  insertMessage(conversationId: string, msg: NormalizedMessage): boolean {
    const existing = this.db
      .prepare(`SELECT id FROM messages WHERE platform = ? AND external_id = ?`)
      .get(msg.platform, msg.externalId) as { id: string } | undefined;
    if (existing) return false;
    this.db.prepare(
      `INSERT INTO messages (id, conversation_id, platform, external_id, direction, sender_id, sender_name, body, language, sent_at, normalized_json)
       VALUES (@id, @conversation_id, @platform, @external_id, @direction, @sender_id, @sender_name, @body, @language, @sent_at, @normalized_json)`,
    ).run({
      id: randomUUID(),
      conversation_id: conversationId,
      platform: msg.platform,
      external_id: msg.externalId,
      direction: msg.direction,
      sender_id: msg.senderId || null,
      sender_name: msg.senderName || null,
      body: msg.body,
      language: null,
      sent_at: msg.sentAt,
      normalized_json: JSON.stringify(msg),
    });
    return true;
  }
}
