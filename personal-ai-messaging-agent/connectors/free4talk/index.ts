import { chromium, type BrowserContext, type Page } from "playwright";
import type {
  ConnectResult,
  ConnectorStatus,
  CurrentUser,
  IntegrationReport,
  NormalizedConversation,
  NormalizedMessage,
  PlatformConnector,
  SendResult,
} from "../platform-connector.ts";
import { IntegrationUnavailable, normalizeMessage } from "../platform-connector.ts";
import { probeRoomDom, type RoomDomProbe } from "./dom.ts";
import { HILDA_ROOM_URL, FREE4TALK_LOGIN, FREE4TALK_ORIGIN, parseFree4TalkRoomUrl } from "./room-url.ts";

export { FREE4TALK_ORIGIN, FREE4TALK_LOGIN, HILDA_ROOM_URL, parseFree4TalkRoomUrl };

export const free4talkReport: IntegrationReport = {
  available: true,
  mode: "authorized_browser",
  reason:
    "Free4Talk has no official messaging API. After you sign in yourself in a local headed Chromium window, this connector can open a room URL you paste, read currently visible public chat from the page DOM, and type into the page’s own “Type a message…” box. It does not invent endpoints, decrypt room tokens, sniff websockets, export cookies, or read private messages.",
  exists: [
    "Public website https://www.free4talk.com/ (SPA, Cloudflare, X-Frame-Options: SAMEORIGIN)",
    "Google Sign-In popup on Free4Talk’s site (this app never asks for a Google password)",
    "Public room URLs of the form https://www.free4talk.com/room/:roomId",
    "In-room ChatBox: visible messages as .message[data-message-id] / .text.main-content, textarea.input-send-box with placeholder “Type a message…”, send button .send-box",
    "Headed Playwright persistent profile under the local data directory (session files stay on disk, never logged)",
  ],
  missing: [
    "Official developer documentation or OAuth app registration",
    "Documented REST/GraphQL inbox, DM, or send API",
    "Permission for third parties to automate rooms without the user sitting in their own browser",
    "Off-screen virtualized history (unviewed ChatBoxMessageItem nodes are height placeholders without text)",
    "Private / PM bubbles in the room (skipped on purpose)",
    "Voice, WebRTC talk, and “Join and talk now!” without you signing in",
  ],
  canBuild: [
    "Connect: open headed Chromium so you sign in on free4talk.com yourself",
    "Paste a /room/:id URL from the address bar",
    "Watch visible public ChatBox nodes (poll + MutationObserver), dedup by data-message-id",
    "Send back as the signed-in room account by typing in the page’s own input and clicking Send only when Free4Talk Auto, Live send, and not-simulation / not-STOP are all set",
  ],
  requiredConfig: [
    "No Free4Talk API key exists to configure",
    "Do not paste a Google or Free4Talk password into this app",
    "You must complete Google Sign-In in the headed window",
    "Then paste https://www.free4talk.com/room/… from that window’s address bar",
  ],
};

function unavailable(operation: string, extra?: string): IntegrationUnavailable {
  return new IntegrationUnavailable("free4talk", operation, {
    ...free4talkReport,
    available: false,
    reason: extra || free4talkReport.reason,
  });
}

export class Free4TalkConnector implements PlatformConnector {
  readonly platform = "free4talk" as const;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private roomId: string | null = null;
  private roomUrl: string | null = null;
  private lastProbe: RoomDomProbe | null = null;
  private watchers = new Set<(message: NormalizedMessage) => void>();
  private seenIds = new Set<string>();
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private monitoring = false;
  private primed = false;
  private observerHooked = false;

  constructor(private readonly dataDir: string, private readonly allowBrowser = process.env.VITEST !== "true") {}

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async connect(): Promise<ConnectResult> {
    const launched = await this.ensureBrowser(FREE4TALK_ORIGIN);
    if (!launched.opened) {
      return {
        status: "awaiting_user",
        message: launched.message,
      };
    }
    const probe = await this.safeProbe();
    const signedIn = this.signedInHint(probe);
    this.lastProbe = probe;
    return {
      status: signedIn ? "connected" : "awaiting_user",
      message: signedIn
        ? "Signed-in Free4Talk window is open. Paste a room URL (https://www.free4talk.com/room/…) to watch visible chat."
        : "Opened Free4Talk in local Chromium. Sign in there yourself (Google prompt is on their site). This app does not collect your Google password. Then paste a room URL.",
      currentUser: signedIn ? { id: "browser-session", displayName: "Free4Talk browser session" } : undefined,
    };
  }

  async disconnect(): Promise<void> {
    await this.logout();
  }

  async getStatus(): Promise<{
    status: ConnectorStatus;
    message: string;
    currentUser?: CurrentUser;
    integration: IntegrationReport;
    room?: { url: string | null; roomId: string | null; probe: RoomDomProbe | null };
    monitoring?: boolean;
  }> {
    const probe = this.page ? await this.safeProbe() : this.lastProbe;
    this.lastProbe = probe;
    const signedIn = this.signedInHint(probe);
    let status: ConnectorStatus = "disconnected";
    let message = "Connect to open a local Chromium window. Sign in on free4talk.com yourself, then paste a room URL.";
    if (this.page) {
      if (probe?.cloudflareChallenge) {
        status = "error";
        message = "Free4Talk showed a browser check. This app will not bypass it. Complete it in the headed window if it is a normal user prompt, or stop.";
      } else if (!signedIn) {
        status = "awaiting_user";
        message =
          probe?.inputPresent && probe.inputDisabled
            ? "Room page mounted the “Type a message…” box, but it is disabled until you finish Google Sign-In in the headed window."
            : "Chromium is open. Sign in on Free4Talk’s Google prompt (not here). Then paste a room URL.";
      } else if (!this.roomUrl) {
        status = "connected";
        message = "Browser session is signed in. Paste https://www.free4talk.com/room/… to read visible chat.";
      } else if (!probe?.inputPresent) {
        status = "awaiting_user";
        message =
          "Room URL is set but the chat input is not in the page yet. Sign in on Free4Talk if asked, wait for ChatBox, or check the URL. This app will not invent an API.";
      } else if (probe.inputDisabled) {
        status = "awaiting_user";
        message =
          "Room page mounted the “Type a message…” box, but it is disabled until you finish Google Sign-In in the headed window. Visible send/read wait on that.";
      } else {
        status = "connected";
        message = this.monitoring
          ? `Monitoring ON. Visible public messages: ${probe.visibleMessageCount}. New inbound goes to ReplyEngine.`
          : `Room ChatBox is visible (${probe.visibleMessageCount} public messages). Turn Monitoring ON to draft/answer as they appear.`;
      }
    }
    return {
      status,
      message,
      currentUser: signedIn ? { id: "browser-session", displayName: "Free4Talk browser session" } : undefined,
      integration: free4talkReport,
      room: { url: this.roomUrl, roomId: this.roomId, probe },
      monitoring: this.monitoring,
    };
  }

  async setRoomUrl(raw: string): Promise<{ ok: boolean; message: string; probe: RoomDomProbe | null; url?: string }> {
    const parsed = parseFree4TalkRoomUrl(raw);
    if (!parsed.ok) {
      return { ok: false, message: parsed.reason, probe: this.lastProbe };
    }
    if (!this.allowBrowser) {
      this.roomUrl = parsed.url;
      this.roomId = parsed.roomId;
      return {
        ok: true,
        url: parsed.url,
        probe: null,
        message: "Room URL accepted. Browser launch is disabled in tests, so the page was not opened.",
      };
    }
    const launched = await this.ensureBrowser(parsed.url);
    if (!launched.opened || !this.page) {
      return { ok: false, message: launched.message, probe: null };
    }
    return this.enqueue(async () => {
      this.roomUrl = parsed.url;
      this.roomId = parsed.roomId;
      this.seenIds.clear();
      this.primed = false;
      try {
        await this.page!.goto(parsed.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await this.page!.waitForTimeout(4000);
      } catch (error) {
        const err = error as Error;
        return { ok: false, message: `Could not open the room page (${err.message}).`, probe: null };
      }
      const probe = await this.page!.evaluate(probeRoomDom);
      const live = parseFree4TalkRoomUrl(probe.href);
      if (live.ok) {
        this.roomUrl = live.url;
        this.roomId = live.roomId;
      }
      this.lastProbe = probe;
      await this.installChatObserver();
      if (this.monitoring) await this.primeSeen();
      if (probe.cloudflareChallenge) {
        return {
          ok: false,
          message: "Cloudflare/browser check is on the room page. Not bypassed. Complete it yourself or stop.",
          probe,
          url: parsed.url,
        };
      }
      if (probe.signInModal || !probe.inputPresent) {
        return {
          ok: true,
          url: parsed.url,
          probe,
          message:
            "Opened the room URL in your headed window. ChatBox input is not usable yet (sign-in modal, not joined, or UI not mounted). Sign in on their page if asked. This app will not invent an API.",
        };
      }
      return {
        ok: true,
        url: parsed.url,
        probe,
        message: `Room open. Visible public messages: ${probe.visibleMessageCount}. Input ${probe.inputDisabled ? "is disabled" : "is ready"} (“${probe.inputPlaceholder || "Type a message…"}”).`,
      };
    });
  }

  async getConversations(): Promise<NormalizedConversation[]> {
    if (!this.roomUrl || !this.roomId) return [];
    const probe = await this.requireRoomDom("getConversations");
    return [
      {
        platform: "free4talk",
        externalId: this.roomId,
        title: `Free4Talk room ${this.roomId}`,
        lastMessageAt: probe.messages.at(-1) ? new Date().toISOString() : undefined,
      },
    ];
  }

  async getConversation(externalId: string): Promise<NormalizedConversation | null> {
    const all = await this.getConversations();
    return all.find((c) => c.externalId === externalId) || null;
  }

  async getMessages(conversationExternalId: string): Promise<NormalizedMessage[]> {
    if (!this.roomId || conversationExternalId !== this.roomId) {
      throw unavailable("getMessages", "Paste a Free4Talk room URL first. There is no inbox API.");
    }
    const probe = await this.requireRoomDom("getMessages");
    return probe.messages.map((m) => this.toNormalized(m));
  }

  async watchForNewMessages(onMessage: (message: NormalizedMessage) => void): Promise<() => void> {
    this.watchers.add(onMessage);
    if (this.monitoring) this.ensureWatchLoop();
    return () => this.watchers.delete(onMessage);
  }

  async setMonitoring(on: boolean): Promise<{ monitoring: boolean }> {
    this.monitoring = on;
    if (on) {
      this.ensureWatchLoop();
      await this.installChatObserver();
      await this.primeSeen();
    } else {
      this.stopWatch();
    }
    return { monitoring: this.monitoring };
  }

  getMonitoring(): boolean {
    return this.monitoring;
  }

  async screenshotTo(file: string): Promise<{ ok: boolean; reason?: string }> {
    if (!this.page) return { ok: false, reason: "No headed Free4Talk page is open." };
    try {
      await this.page.screenshot({ path: file, fullPage: false });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async sendMessage(conversationExternalId: string, body: string, options?: { simulate?: boolean }): Promise<SendResult> {
    const text = body.trim();
    if (!text) throw new Error("Message body is empty");
    if (!this.roomId || (conversationExternalId && conversationExternalId !== this.roomId)) {
      throw unavailable("sendMessage", "Paste a room URL and wait until the page shows “Type a message…” before sending.");
    }
    const probe = await this.requireRoomDom("sendMessage");
    if (!probe.inputPresent) {
      throw unavailable(
        "sendMessage",
        "The room page has no usable chat textarea. Exists: room URL field and headed window. Missing: .input-send-box textarea. Not inventing a send endpoint.",
      );
    }
    if (options?.simulate) {
      await this.typeIntoRoomInput(text, { submit: false });
      return { simulated: true, sentAt: new Date().toISOString(), externalId: `sim-${Date.now()}` };
    }
    if (!probe.signedInAccountReady || probe.inputDisabled) {
      throw unavailable(
        "sendMessage",
        "Cannot send as the signed-in room account: the “Type a message…” box is disabled. Finish Google Sign-In in the headed Free4Talk window first.",
      );
    }
    const before = new Set(probe.messages.map((m) => m.id));
    await this.typeIntoRoomInput(text, { submit: true });
    await this.page?.waitForTimeout(1500);
    const after = await this.safeProbe();
    const appeared = (after?.messages || []).some((m) => m.body.includes(text) && !before.has(m.id));
    if (!appeared && this.lastTypedStillPresent) {
      throw new Error(
        "Typed into the room input as the signed-in account but the page did not accept the send (text still in the box). Not reporting a fake send.",
      );
    }
    const newId = (after?.messages || []).find((m) => m.body.includes(text) && !before.has(m.id))?.id;
    return {
      simulated: false,
      sentAt: new Date().toISOString(),
      externalId: newId || `dom-${Date.now()}`,
    };
  }

  async markAsRead(_conversationExternalId: string): Promise<void> {
    return;
  }

  async getCurrentUser(): Promise<CurrentUser | null> {
    const signedIn = this.signedInHint(this.lastProbe);
    return signedIn ? { id: "browser-session", displayName: "Free4Talk browser session" } : null;
  }

  async logout(): Promise<void> {
    this.stopWatch();
    this.roomId = null;
    this.roomUrl = null;
    this.lastProbe = null;
    this.seenIds.clear();
    this.primed = false;
    this.monitoring = false;
    this.observerHooked = false;
    this.page = null;
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = null;
    }
  }

  async openPlatform(): Promise<{ url: string }> {
    return { url: this.roomUrl || FREE4TALK_ORIGIN };
  }

  private lastTypedStillPresent = false;

  private signedInHint(probe: RoomDomProbe | null): boolean {
    if (!probe) return false;
    if (probe.signInModal || probe.googleSignIn || probe.cloudflareChallenge) return false;
    return Boolean(probe.inputPresent && !probe.inputDisabled);
  }

  private toNormalized(m: { id: string; senderName: string; body: string; isMyself?: boolean }): NormalizedMessage {
    return normalizeMessage({
      platform: "free4talk",
      externalId: m.id || `visible-${m.body.slice(0, 24)}`,
      conversationExternalId: this.roomId || "room",
      conversationTitle: `Free4Talk room ${this.roomId || ""}`.trim(),
      direction: m.isMyself ? "outbound" : "inbound",
      senderName: m.isMyself ? "Me (signed-in room account)" : m.senderName || "Unknown",
      body: m.body,
      sentAt: new Date().toISOString(),
      rawType: m.isMyself ? "free4talk.visible-dom.myself" : "free4talk.visible-dom",
    });
  }

  private async requireRoomDom(operation: string): Promise<RoomDomProbe> {
    if (!this.page) {
      throw unavailable(operation, "Connect first so a headed Chromium window is open, then paste a room URL.");
    }
    if (!this.roomUrl) {
      throw unavailable(operation, "Paste a https://www.free4talk.com/room/… URL. There is no inbox API to list rooms.");
    }
    const probe = await this.safeProbe();
    this.lastProbe = probe;
    if (!probe) {
      throw unavailable(operation, "Could not read the room page DOM.");
    }
    if (probe.cloudflareChallenge) {
      throw unavailable(operation, "Browser check / Cloudflare interstitial is visible. Not bypassed.");
    }
    if (!probe.chatRootPresent && !probe.inputPresent) {
      throw unavailable(
        operation,
        `Room page is open but ChatBox is not in the DOM. Exists: headed window, pasted URL ${probe.href}. Missing: .input-send-box textarea and .message[data-message-id] list (sign-in still required, or the room UI did not mount). Not using unpublished /messages or heroku hosts.`,
      );
    }
    return probe;
  }

  private async safeProbe(): Promise<RoomDomProbe | null> {
    if (!this.page) return null;
    try {
      return await this.page.evaluate(probeRoomDom);
    } catch {
      return null;
    }
  }

  private async typeIntoRoomInput(text: string, opts: { submit: boolean }): Promise<void> {
    if (!this.page) throw unavailable("sendMessage", "No headed page is open.");
    await this.enqueue(async () => {
      const input = this.page!.locator('.input-send-box textarea, textarea[placeholder*="Type a message"]').first();
      if ((await input.count()) === 0) {
        throw unavailable("sendMessage", "No room chat textarea in the page.");
      }
      if (await input.isDisabled()) {
        throw unavailable(
          "sendMessage",
          "The room chat textarea is disabled. Sign in on Free4Talk in the headed window so send uses that room account.",
        );
      }
      await input.click({ timeout: 5000 });
      await input.fill("");
      await input.pressSequentially(text, { delay: 20 });
      this.lastTypedStillPresent = true;
      if (!opts.submit) {
        await input.fill("");
        this.lastTypedStillPresent = false;
        return;
      }
      const sendBtn = this.page!.locator(".input-send-box .send-box").first();
      try {
        await sendBtn.waitFor({ state: "visible", timeout: 4000 });
        await this.page!.waitForFunction(
          () => {
            const btn = document.querySelector(".input-send-box .send-box") as HTMLButtonElement | null;
            return !!btn && !btn.disabled;
          },
          { timeout: 4000 },
        );
        await sendBtn.click();
      } catch {
        await input.press("Enter");
      }
      await this.page!.waitForTimeout(600);
      const remaining = await input.inputValue().catch(() => "");
      this.lastTypedStillPresent = remaining.trim() === text;
    });
  }

  private ensureWatchLoop() {
    if (this.watchTimer) return;
    this.watchTimer = setInterval(() => {
      if (!this.monitoring) return;
      this.pollVisible().catch(() => undefined);
    }, 1500);
  }

  private stopWatch() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }

  private async primeSeen() {
    const probe = await this.safeProbe();
    if (!probe) return;
    this.lastProbe = probe;
    for (const m of probe.messages) {
      if (m.id) this.seenIds.add(m.id);
    }
    this.primed = true;
  }

  private async pollVisible() {
    if (!this.page || !this.roomId || !this.monitoring) return;
    const probe = await this.safeProbe();
    if (!probe) return;
    this.lastProbe = probe;
    if (!this.primed) {
      await this.primeSeen();
      return;
    }
    for (const m of probe.messages) {
      if (!m.id || this.seenIds.has(m.id)) continue;
      this.seenIds.add(m.id);
      if (m.isMyself || m.isPrivate || !m.viewed || !m.body) continue;
      const normalized = this.toNormalized(m);
      if (normalized.direction !== "inbound") continue;
      for (const fn of this.watchers) fn(normalized);
    }
  }

  private async installChatObserver() {
    if (!this.page) return;
    if (!this.observerHooked) {
      try {
        await this.page.exposeFunction("__f4tChatMutated", () => {
          if (this.monitoring) this.pollVisible().catch(() => undefined);
        });
      } catch {
        // already exposed on this page
      }
      this.observerHooked = true;
    }
    await this.page.evaluate(() => {
      const w = window as unknown as { __f4tObserver?: MutationObserver; __f4tChatMutated?: () => void };
      w.__f4tObserver?.disconnect();
      const root = document.querySelector(".react-container.translate-container") || document.body;
      w.__f4tObserver = new MutationObserver(() => {
        w.__f4tChatMutated?.();
      });
      w.__f4tObserver.observe(root, { childList: true, subtree: true, characterData: true });
    }).catch(() => undefined);
  }

  private async ensureBrowser(initialUrl: string): Promise<{ opened: boolean; message: string }> {
    if (!this.allowBrowser) {
      return {
        opened: false,
        message: "Browser launch is disabled in tests. Open https://www.free4talk.com/ yourself. Never paste a Google password into this app.",
      };
    }
    if (this.page && this.context) {
      return { opened: true, message: "Reusing the local Free4Talk Chromium window." };
    }
    try {
      const userDataDir = `${this.dataDir}/free4talk-profile`;
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
      });
      const page = context.pages()[0] || (await context.newPage());
      await page.goto(initialUrl || FREE4TALK_LOGIN, { waitUntil: "domcontentloaded", timeout: 30000 });
      this.context = context;
      this.page = page;
      this.observerHooked = false;
      return {
        opened: true,
        message:
          "Opened Free4Talk in a local Chromium window. Sign in there yourself. This app does not collect your Google password and does not read cookies into logs.",
      };
    } catch (error) {
      const err = error as Error;
      return {
        opened: false,
        message: `Could not launch Chromium (${err.message}). Install browsers with npx playwright install chromium. Do not paste a Free4Talk password here.`,
      };
    }
  }
}
