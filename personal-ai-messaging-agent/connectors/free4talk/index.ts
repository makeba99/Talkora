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
import { IntegrationUnavailable } from "../platform-connector.ts";

export const FREE4TALK_ORIGIN = "https://www.free4talk.com";
export const FREE4TALK_LOGIN = "https://www.free4talk.com/login";

export const free4talkReport: IntegrationReport = {
  available: false,
  reason:
    "Free4Talk has no official public messaging API. Login is a Google Sign-In page on free4talk.com; room backends are undocumented per-room hosts. This connector will not invent endpoints, scrape private messages, intercept cookies, or claim a successful send.",
  exists: [
    "Public website https://www.free4talk.com/ (SPA, Cloudflare, X-Frame-Options: SAMEORIGIN)",
    "Login route /login using Google Sign-In (OAuth client id is in the public frontend bundle; this app never asks for a Google password)",
    "Public rooms UI at /room/:roomId",
    "Identity host identity.free4talk.com exists but has no published contract (unauthenticated /identity/get/me/ returns 404)",
    "Frontend constructs undocumented per-room hosts of the form free4talk-{name}.herokuapp.com and {name}.free4talk.com",
  ],
  missing: [
    "Official developer documentation",
    "OAuth app registration for third-party clients",
    "Documented REST or GraphQL inbox/DM API",
    "Documented send-message API",
    "Documented webhook or change-notification API",
    "Permission for third parties to automate rooms or private chat",
  ],
  canBuild: [
    "Open Platform in the user's own browser (https://www.free4talk.com/)",
    "Optional headed Playwright window so the user can sign in themselves — session files stay on disk and are never logged",
    "Honest Integration unavailable status for retrieve/send until Free4Talk publishes an API",
  ],
  requiredConfig: [
    "No Free4Talk API key exists to configure",
    "Do not paste a Google or Free4Talk password into this app",
    "If Free4Talk later publishes an API, add the documented base URL and a user-authorized token here",
  ],
};

export class Free4TalkConnector implements PlatformConnector {
  readonly platform = "free4talk" as const;
  private sessionConnected = false;
  private currentUser: CurrentUser | null = null;
  private watchers = new Set<(message: NormalizedMessage) => void>();
  private playwrightCloser: (() => Promise<void>) | null = null;

  constructor(private readonly dataDir: string, private readonly allowBrowser = process.env.VITEST !== "true") {}

  async connect(): Promise<ConnectResult> {
    const launched = await this.launchUserBrowser();
    if (launched.opened) {
      this.sessionConnected = launched.signedInHint;
      this.currentUser = launched.signedInHint
        ? { id: "browser-session", displayName: "Free4Talk browser session" }
        : null;
      return {
        status: launched.signedInHint ? "connected" : "awaiting_user",
        message: launched.message,
        currentUser: this.currentUser ?? undefined,
      };
    }
    return {
      status: "integration_unavailable",
      message: `${free4talkReport.reason} Open ${FREE4TALK_ORIGIN} in your browser to use the site yourself. ${launched.message}`,
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
  }> {
    const status: ConnectorStatus = this.sessionConnected ? "connected" : "integration_unavailable";
    return {
      status,
      message: this.sessionConnected
        ? "A local browser session was opened. Message retrieve/send remain Integration unavailable — there is no official API."
        : free4talkReport.reason!,
      currentUser: this.currentUser ?? undefined,
      integration: free4talkReport,
    };
  }

  async getConversations(): Promise<NormalizedConversation[]> {
    throw new IntegrationUnavailable("free4talk", "getConversations", free4talkReport);
  }

  async getConversation(_externalId: string): Promise<NormalizedConversation | null> {
    throw new IntegrationUnavailable("free4talk", "getConversation", free4talkReport);
  }

  async getMessages(_conversationExternalId: string): Promise<NormalizedMessage[]> {
    throw new IntegrationUnavailable("free4talk", "getMessages", free4talkReport);
  }

  async watchForNewMessages(onMessage: (message: NormalizedMessage) => void): Promise<() => void> {
    this.watchers.add(onMessage);
    return () => this.watchers.delete(onMessage);
  }

  async sendMessage(_conversationExternalId: string, _body: string, options?: { simulate?: boolean }): Promise<SendResult> {
    if (options?.simulate) {
      throw new IntegrationUnavailable("free4talk", "sendMessage", {
        ...free4talkReport,
        reason:
          "Simulation cannot invent a Free4Talk send. There is no documented send endpoint to dry-run against.",
      });
    }
    throw new IntegrationUnavailable("free4talk", "sendMessage", free4talkReport);
  }

  async markAsRead(_conversationExternalId: string): Promise<void> {
    throw new IntegrationUnavailable("free4talk", "markAsRead", free4talkReport);
  }

  async getCurrentUser(): Promise<CurrentUser | null> {
    return this.currentUser;
  }

  async logout(): Promise<void> {
    this.sessionConnected = false;
    this.currentUser = null;
    if (this.playwrightCloser) {
      await this.playwrightCloser().catch(() => undefined);
      this.playwrightCloser = null;
    }
  }

  async openPlatform(): Promise<{ url: string }> {
    return { url: FREE4TALK_ORIGIN };
  }

  private async launchUserBrowser(): Promise<{ opened: boolean; signedInHint: boolean; message: string }> {
    if (!this.allowBrowser) {
      return {
        opened: false,
        signedInHint: false,
        message: "Browser launch is disabled in tests. Open https://www.free4talk.com/ yourself. Messaging APIs still do not exist.",
      };
    }
    let playwrightMod: typeof import("playwright") | null = null;
    try {
      playwrightMod = await import("playwright");
    } catch {
      return {
        opened: false,
        signedInHint: false,
        message:
          "Playwright is not installed. Run npm install in this app directory if you want a local browser window. Messaging APIs still do not exist.",
      };
    }
    if (!playwrightMod) {
      return {
        opened: false,
        signedInHint: false,
        message: "Playwright is not available.",
      };
    }
    try {
      const userDataDir = `${this.dataDir}/free4talk-profile`;
      const context = await playwrightMod.chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
      });
      const page = context.pages()[0] || (await context.newPage());
      await page.goto(FREE4TALK_LOGIN, { waitUntil: "domcontentloaded", timeout: 30000 });
      this.playwrightCloser = async () => {
        await context.close();
      };
      const url = page.url();
      const signedInHint = !url.includes("/login");
      return {
        opened: true,
        signedInHint,
        message:
          "Opened Free4Talk in a local Chromium window. Sign in there yourself (Google prompt is on their site). This app does not collect your Google password, does not read cookies into logs, and still cannot retrieve or send Free4Talk messages without an official API.",
      };
    } catch (error) {
      const err = error as Error;
      return {
        opened: false,
        signedInHint: false,
        message: `Could not launch Chromium (${err.message}). Install browsers with npx playwright install chromium. Do not paste a Free4Talk password here.`,
      };
    }
  }
}
