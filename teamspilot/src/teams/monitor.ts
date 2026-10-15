import type { DraftPipeline } from "../pipeline/handle.js";
import type { DraftStore } from "../core/store.js";
import type { Settings } from "../core/types.js";
import type { ProbeInterpretation } from "./match-chat.js";
import type { TeamsReader } from "./reader.js";

const OVERLAP_MS = 120_000;
const PAGES_PER_SCAN = 4;

export interface Scheduler {
  schedule(fn: () => void, ms: number): { cancel(): void };
}

export interface WindowProbe {
  probe(chats: { id: string; label: string; chatType: string }[]): Promise<ProbeInterpretation>;
}

export interface MonitorLogger {
  info(event: string, fields?: { chatId?: string; detail?: string; count?: number; status?: string }): void;
  error(event: string, fields?: { chatId?: string; detail?: string; status?: string }): void;
}

const defaultScheduler: Scheduler = {
  schedule(fn, ms) {
    const timer = setTimeout(fn, ms);
    return { cancel: () => clearTimeout(timer) };
  },
};

export class ChatMonitor {
  private state: "stopped" | "running" | "paused" = "stopped";
  private timer: { cancel(): void } | null = null;
  private draftOnlyReason: string | null = "Monitoring is stopped.";
  private lastError: string | null = null;
  private lastPollAt: string | null = null;
  private detectionTruncated = false;
  private lastProbe: ProbeInterpretation | null = null;
  private ticking = false;
  private active: Promise<void> | null = null;

  constructor(
    private readonly deps: {
      reader: TeamsReader;
      pipeline: DraftPipeline;
      store: DraftStore;
      settings: () => Settings;
      saveSettings: (settings: Settings) => void;
      probe: WindowProbe;
      log: MonitorLogger;
      scheduler?: Scheduler;
    },
  ) {}

  getState(): "stopped" | "running" | "paused" {
    return this.state;
  }

  snapshot(): {
    monitoring: "stopped" | "running" | "paused";
    mode: "draft-only" | "monitoring";
    draftOnlyReason: string | null;
    lastError: string | null;
    lastPollAt: string | null;
    detectionTruncated: boolean;
    lastProbe: ProbeInterpretation | null;
  } {
    return {
      monitoring: this.state,
      mode: this.state === "running" ? "monitoring" : "draft-only",
      draftOnlyReason: this.state === "running" ? null : this.draftOnlyReason,
      lastError: this.lastError,
      lastPollAt: this.lastPollAt,
      detectionTruncated: this.detectionTruncated,
      lastProbe: this.lastProbe,
    };
  }

  start(): { ok: true } | { ok: false; reason: string } {
    if (!this.deps.reader.canDetect()) {
      this.state = "stopped";
      this.draftOnlyReason = "Microsoft Graph is not signed in, so TeamsPilot is in draft-only mode and is not detecting messages.";
      this.deps.log.info("monitoring_blocked", { detail: this.draftOnlyReason, status: "draft-only" });
      return { ok: false, reason: this.draftOnlyReason };
    }
    const chatId = this.deps.settings().monitoredChatId;
    if (!chatId) {
      this.draftOnlyReason = "Select a chat before monitoring. Graph cannot see which chat is open in Teams.";
      this.deps.log.info("monitoring_blocked", { detail: this.draftOnlyReason, status: "draft-only" });
      return { ok: false, reason: this.draftOnlyReason };
    }
    this.state = "running";
    this.draftOnlyReason = null;
    this.deps.log.info("monitoring_started", { chatId, status: "running" });
    this.active = this.tick();
    return { ok: true };
  }

  async idle(): Promise<void> {
    if (this.active) await this.active;
  }

  rememberProbe(probe: ProbeInterpretation): void {
    this.lastProbe = probe;
  }

  pause(): void {
    if (this.state === "stopped") return;
    this.state = "paused";
    this.draftOnlyReason = "Monitoring is paused. In-flight replies were stopped. Nothing is sent.";
    this.timer?.cancel();
    this.timer = null;
    this.deps.pipeline.cancelAll();
    this.deps.log.info("monitoring_paused", { status: "paused" });
  }

  stop(): void {
    this.state = "stopped";
    this.draftOnlyReason = "Monitoring is stopped.";
    this.timer?.cancel();
    this.timer = null;
    this.deps.pipeline.cancelAll();
    this.deps.log.info("monitoring_stopped", { status: "stopped" });
  }

  async pollOnce(): Promise<void> {
    if (this.state !== "running") return;
    if (!this.deps.reader.canDetect()) {
      this.pause();
      this.draftOnlyReason = "The Microsoft connection dropped. Existing drafts were kept. Nothing was sent.";
      return;
    }
    const settings = this.deps.settings();
    let chatId = settings.monitoredChatId;
    if (!chatId) return;
    if (settings.followTeamsWindow) {
      try {
        const chats = await this.deps.reader.listChats();
        const probe = await this.deps.probe.probe(chats);
        this.lastProbe = probe;
        if (probe.confidence === "high" && probe.followChatId && probe.followChatId !== chatId) {
          const match = chats.find((chat) => chat.id === probe.followChatId);
          const next = { ...settings, monitoredChatId: probe.followChatId, monitoredChatLabel: match?.label ?? settings.monitoredChatLabel };
          this.deps.saveSettings(next);
          chatId = probe.followChatId;
          this.deps.log.info("chat_follow_switched", { chatId, status: "running" });
        }
      } catch {
        this.deps.log.error("probe_failed", { chatId, detail: "The Teams window probe failed. The selected chat was left unchanged." });
      }
    }
    const chat = (await this.safeChats()).find((item) => item.id === chatId);
    const label = chat?.label || settings.monitoredChatLabel || "Selected chat";
    try {
      const incoming = await this.collectIncoming(chatId);
      this.lastPollAt = new Date().toISOString();
      this.lastError = null;
      for (const message of incoming) {
        if (this.state !== "running") return;
        await this.deps.pipeline.handleIncoming(message, "teams", label);
      }
    } catch {
      this.lastError = "A poll failed. TeamsPilot will try again. Drafts already created were kept, and nothing was sent.";
      this.deps.log.error("poll_failed", { chatId, detail: this.lastError, status: "running" });
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking || this.state !== "running") return;
    this.ticking = true;
    try {
      await this.pollOnce();
    } finally {
      this.ticking = false;
      if (this.state === "running") this.arm();
    }
  }

  private arm(): void {
    this.timer?.cancel();
    const wait = this.deps.settings().pollIntervalMs;
    this.timer = (this.deps.scheduler ?? defaultScheduler).schedule(() => {
      void this.tick();
    }, wait);
  }

  private async safeChats(): Promise<{ id: string; label: string; chatType: string }[]> {
    try {
      return await this.deps.reader.listChats();
    } catch {
      return [];
    }
  }

  private async collectIncoming(chatId: string): Promise<import("../core/types.js").NormalizedMessage[]> {
    const cursor = this.deps.store.cursor(chatId);
    const priming = !cursor.primed;
    const floor = Date.parse(cursor.watermark) - OVERLAP_MS;
    const incoming: import("../core/types.js").NormalizedMessage[] = [];
    const head = await this.scan(chatId, null, floor, !priming, incoming);
    let reached = head.reached;
    if (!reached && cursor.backlogPath) {
      const backlog = await this.scan(chatId, cursor.backlogPath, floor, !priming, incoming);
      reached = backlog.reached;
      cursor.backlogPath = reached ? null : backlog.nextPath;
    } else {
      cursor.backlogPath = reached ? null : head.nextPath;
    }
    this.detectionTruncated = !priming && !reached && Boolean(cursor.backlogPath);
    if (this.detectionTruncated) {
      this.deps.log.error("detection_truncated", {
        chatId,
        detail: "This poll did not reach the previous watermark. Detection may be incomplete.",
        status: "running",
      });
    }
    if (priming) {
      cursor.primed = true;
      cursor.watermark = new Date().toISOString();
      cursor.backlogPath = null;
      this.detectionTruncated = false;
      this.deps.store.saveCursor(chatId, cursor);
      this.deps.log.info("baseline_recorded", {
        chatId,
        detail: "Messages already in this chat were marked seen and were not drafted.",
      });
      return [];
    }
    if (reached) {
      cursor.watermark = new Date().toISOString();
      cursor.backlogPath = null;
    }
    this.deps.store.saveCursor(chatId, cursor);
    return incoming.reverse();
  }

  private async scan(
    chatId: string,
    start: string | null,
    floor: number,
    applyFloor: boolean,
    incoming: import("../core/types.js").NormalizedMessage[],
  ): Promise<{ reached: boolean; nextPath: string | null }> {
    let path = start;
    let pages = 0;
    while (pages < PAGES_PER_SCAN) {
      const page = await this.deps.reader.fetchPage(chatId, path);
      pages += 1;
      for (const entry of page.entries) {
        const created = Date.parse(entry.createdAt);
        if (applyFloor && !Number.isNaN(created) && created < floor) return { reached: true, nextPath: null };
        if (this.deps.store.isProcessed(entry.id)) continue;
        // The pipeline records draftable ids. Mark everything else here so it is not scanned forever.
        if (!applyFloor || !entry.message || entry.message.mine) {
          this.deps.store.markProcessed(entry.id);
          continue;
        }
        incoming.push(entry.message);
      }
      if (!page.nextPath) return { reached: true, nextPath: null };
      path = page.nextPath;
    }
    return { reached: false, nextPath: path };
  }
}
