import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { decryptSecret, encryptSecret, teamsClientId, teamsTenantId } from "../../security/index.ts";
import type {
  ConnectResult,
  CurrentUser,
  IntegrationReport,
  NormalizedConversation,
  NormalizedMessage,
  PlatformConnector,
  SendResult,
} from "../platform-connector.ts";
import { IntegrationUnavailable, normalizeMessage } from "../platform-connector.ts";
import {
  getChat,
  getMe,
  GraphError,
  htmlToText,
  listChatMessages,
  listChats,
  markChatRead,
  pollDeviceToken,
  refreshAccessToken,
  requestDeviceCode,
  sendChatMessage,
  tokenExpired,
  type DeviceCodeResponse,
  type TokenSet,
} from "./graph.ts";

export const teamsReport: IntegrationReport = {
  available: true,
  reason:
    "Microsoft Graph provides delegated chat APIs for work or school accounts. This connector uses device code flow — you sign in at microsoft.com/devicelogin. Personal Microsoft accounts are not supported. Live send stays off until you disable simulation.",
  exists: [
    "POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/devicecode",
    "POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token (device_code and refresh_token grants)",
    "GET https://graph.microsoft.com/v1.0/me",
    "GET https://graph.microsoft.com/v1.0/me/chats",
    "GET https://graph.microsoft.com/v1.0/chats/{id}",
    "GET https://graph.microsoft.com/v1.0/chats/{id}/messages",
    "POST https://graph.microsoft.com/v1.0/chats/{id}/messages",
    "POST https://graph.microsoft.com/v1.0/chats/{id}/markChatReadForUser",
  ],
  missing: [
    "Personal Microsoft account chat APIs (not supported)",
    "Application-only send for live chat (Graph only allows Teamwork.Migrate.All import, not live send)",
    "Username/password ROPC (this app will not collect Microsoft passwords)",
  ],
  canBuild: [
    "Device-code sign-in for a public client app you register in Entra",
    "List and read 1:1/group chats the signed-in user can access",
    "Draft/approve replies locally; POST a chat message only when live send is enabled",
  ],
  requiredConfig: [
    "Entra app registration (public client, Allow public client flows = Yes)",
    "TEAMS_CLIENT_ID in .env (application/client ID, not a password)",
    "TEAMS_TENANT_ID (organizations, a tenant id, or common — chat APIs still require a work/school account)",
    "Delegated permissions User.Read, Chat.ReadWrite, ChatMessage.Send",
    "Tenant admin consent if your org requires it",
  ],
};

type DeviceFlow = {
  device: DeviceCodeResponse;
  startedAt: number;
  pollTimer?: ReturnType<typeof setInterval>;
};

export class TeamsConnector implements PlatformConnector {
  readonly platform = "teams" as const;
  private deviceFlow: DeviceFlow | null = null;
  private fetchFn: typeof fetch;

  constructor(
    private readonly db: Database,
    private readonly rootDir: string,
    fetchFn: typeof fetch = fetch,
  ) {
    this.fetchFn = fetchFn;
  }

  async connect(): Promise<ConnectResult> {
    const clientId = teamsClientId();
    if (!clientId) {
      return {
        status: "not_configured",
        message:
          "Teams is not configured. Create an Entra public-client app, enable public client flows, grant User.Read, Chat.ReadWrite, and ChatMessage.Send, then set TEAMS_CLIENT_ID in .env. This app will never ask for your Microsoft password.",
      };
    }
    const existing = await this.getValidToken().catch(() => null);
    if (existing) {
      const me = await getMe(existing.access_token, this.fetchFn);
      this.persistUser(me);
      return {
        status: "connected",
        message: `Signed in as ${me.displayName || me.userPrincipalName || me.id}`,
        currentUser: toUser(me),
      };
    }
    const device = await requestDeviceCode(teamsTenantId(), clientId, this.fetchFn);
    this.deviceFlow = { device, startedAt: Date.now() };
    this.startPolling(clientId, device);
    return {
      status: "awaiting_user",
      message: device.message,
      deviceLogin: {
        userCode: device.user_code,
        verificationUri: device.verification_uri,
        message: device.message,
        expiresIn: device.expires_in,
      },
    };
  }

  async disconnect(): Promise<void> {
    await this.logout();
  }

  async getStatus() {
    const clientId = teamsClientId();
    if (!clientId) {
      return {
        status: "not_configured" as const,
        message: "TEAMS_CLIENT_ID is not set. Not signed in.",
        integration: {
          ...teamsReport,
          reason: "TEAMS_CLIENT_ID is not set. Graph chat APIs exist; this app will not pretend to be signed in until you register an Entra public client.",
        },
      };
    }
    if (this.deviceFlow) {
      return {
        status: "awaiting_user" as const,
        message: this.deviceFlow.device.message,
        integration: teamsReport,
        deviceLogin: {
          userCode: this.deviceFlow.device.user_code,
          verificationUri: this.deviceFlow.device.verification_uri,
          message: this.deviceFlow.device.message,
          expiresIn: this.deviceFlow.device.expires_in,
        },
      };
    }
    try {
      const token = await this.getValidToken();
      const me = await getMe(token.access_token, this.fetchFn);
      return {
        status: "connected" as const,
        message: `Signed in as ${me.displayName || me.userPrincipalName}`,
        currentUser: toUser(me),
        integration: teamsReport,
      };
    } catch (error) {
      return {
        status: "disconnected" as const,
        message: error instanceof Error ? error.message : "Not signed in",
        integration: teamsReport,
      };
    }
  }

  async getConversations(): Promise<NormalizedConversation[]> {
    const token = await this.getValidToken();
    const chats = await listChats(token.access_token, this.fetchFn);
    return chats.map((chat) => ({
      platform: "teams" as const,
      externalId: chat.id,
      title: chatTitle(chat),
      lastMessageAt: chat.lastMessagePreview?.createdDateTime || chat.lastUpdatedDateTime,
      participants: (chat.members || []).map((m) => m.displayName || m.email || m.userId || "").filter(Boolean),
    }));
  }

  async getConversation(externalId: string): Promise<NormalizedConversation | null> {
    const token = await this.getValidToken();
    try {
      const chat = await getChat(token.access_token, externalId, this.fetchFn);
      return {
        platform: "teams",
        externalId: chat.id,
        title: chatTitle(chat),
        lastMessageAt: chat.lastUpdatedDateTime,
      };
    } catch (error) {
      if (error instanceof GraphError && error.status === 404) return null;
      throw error;
    }
  }

  async getMessages(conversationExternalId: string): Promise<NormalizedMessage[]> {
    const token = await this.getValidToken();
    const me = await getMe(token.access_token, this.fetchFn);
    const items = await listChatMessages(token.access_token, conversationExternalId, this.fetchFn);
    const chat = await getChat(token.access_token, conversationExternalId, this.fetchFn).catch(() => null);
    return items
      .filter((m) => m.messageType === "message" || !m.messageType)
      .map((m) =>
        normalizeMessage({
          platform: "teams",
          externalId: m.id,
          conversationExternalId,
          conversationTitle: chat ? chatTitle(chat) : conversationExternalId,
          direction: m.from?.user?.id === me.id ? "outbound" : "inbound",
          senderId: m.from?.user?.id,
          senderName: m.from?.user?.displayName,
          body: htmlToText(m.body?.content),
          sentAt: m.createdDateTime || new Date().toISOString(),
          rawType: "graph.chatMessage",
        }),
      )
      .filter((m) => m.body.length > 0);
  }

  async watchForNewMessages(onMessage: (message: NormalizedMessage) => void): Promise<() => void> {
    let stopped = false;
    const seen = new Set<string>();
    const tick = async () => {
      if (stopped) return;
      try {
        const convos = await this.getConversations();
        for (const convo of convos.slice(0, 20)) {
          const messages = await this.getMessages(convo.externalId);
          for (const msg of messages) {
            if (seen.has(msg.externalId)) continue;
            seen.add(msg.externalId);
            if (msg.direction === "inbound") onMessage(msg);
          }
        }
      } catch {
        // Poll errors are surfaced via getStatus; do not fake messages.
      }
    };
    const timer = setInterval(tick, 20_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }

  async sendMessage(conversationExternalId: string, body: string, options?: { simulate?: boolean }): Promise<SendResult> {
    if (options?.simulate) {
      return { simulated: true, sentAt: new Date().toISOString() };
    }
    const token = await this.getValidToken();
    const created = await sendChatMessage(token.access_token, conversationExternalId, body, this.fetchFn);
    return {
      simulated: false,
      externalId: created.id,
      sentAt: created.createdDateTime || new Date().toISOString(),
    };
  }

  async markAsRead(conversationExternalId: string): Promise<void> {
    const token = await this.getValidToken();
    const me = await getMe(token.access_token, this.fetchFn);
    const tenant = inferTenant(me) || teamsTenantId();
    if (!tenant || tenant === "organizations" || tenant === "common") {
      throw new IntegrationUnavailable("teams", "markAsRead", {
        ...teamsReport,
        available: false,
        reason:
          "markChatReadForUser requires the signed-in user's tenant GUID. Set TEAMS_TENANT_ID to your directory ID (not 'organizations').",
      });
    }
    await markChatRead(token.access_token, conversationExternalId, me.id, tenant, this.fetchFn);
  }

  async getCurrentUser(): Promise<CurrentUser | null> {
    try {
      const token = await this.getValidToken();
      return toUser(await getMe(token.access_token, this.fetchFn));
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    if (this.deviceFlow?.pollTimer) clearInterval(this.deviceFlow.pollTimer);
    this.deviceFlow = null;
    this.db.prepare(`DELETE FROM platform_sessions WHERE platform = 'teams'`).run();
    this.db.prepare(
      `UPDATE platform_connections SET status = 'disconnected', display_name = NULL, external_user_id = NULL, last_error = NULL, connected_at = NULL, updated_at = ? WHERE platform = 'teams'`,
    ).run(new Date().toISOString());
  }

  async openPlatform(): Promise<{ url: string }> {
    return { url: "https://teams.microsoft.com/" };
  }

  private startPolling(clientId: string, device: DeviceCodeResponse): void {
    const intervalMs = Math.max(device.interval || 5, 5) * 1000;
    const timer = setInterval(async () => {
      try {
        const result = await pollDeviceToken(teamsTenantId(), clientId, device.device_code, this.fetchFn);
        if ("pending" in result) return;
        this.storeToken(result);
        const me = await getMe(result.access_token, this.fetchFn);
        this.persistUser(me);
        if (this.deviceFlow?.pollTimer) clearInterval(this.deviceFlow.pollTimer);
        this.deviceFlow = null;
      } catch (error) {
        if (this.deviceFlow?.pollTimer) clearInterval(this.deviceFlow.pollTimer);
        this.deviceFlow = null;
        const message = error instanceof Error ? error.message : "Device login failed";
        this.db.prepare(
          `UPDATE platform_connections SET status = 'error', last_error = ?, updated_at = ? WHERE platform = 'teams'`,
        ).run(message, new Date().toISOString());
      }
    }, intervalMs);
    timer.unref();
    if (this.deviceFlow) this.deviceFlow.pollTimer = timer;
  }

  private storeToken(token: TokenSet): void {
    const payload = encryptSecret(this.rootDir, JSON.stringify(token));
    const now = new Date().toISOString();
    const expires = new Date(token.obtained_at + token.expires_in * 1000).toISOString();
    this.db.prepare(
      `INSERT INTO platform_sessions (id, platform, encrypted_payload, expires_at, updated_at)
       VALUES (@id, 'teams', @payload, @expires, @now)
       ON CONFLICT(platform) DO UPDATE SET encrypted_payload = @payload, expires_at = @expires, updated_at = @now`,
    ).run({ id: randomUUID(), payload, expires, now });
  }

  private persistUser(me: { id: string; displayName?: string; mail?: string; userPrincipalName?: string }): void {
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE platform_connections
       SET status = 'connected', display_name = @name, external_user_id = @id, last_error = NULL, connected_at = COALESCE(connected_at, @now), updated_at = @now
       WHERE platform = 'teams'`,
    ).run({ name: me.displayName || me.userPrincipalName || me.id, id: me.id, now });
  }

  async getValidToken(): Promise<TokenSet> {
    const row = this.db.prepare(`SELECT encrypted_payload FROM platform_sessions WHERE platform = 'teams'`).get() as
      | { encrypted_payload: string }
      | undefined;
    if (!row) throw new Error("Teams is not signed in. Connect with device code first.");
    let token = JSON.parse(decryptSecret(this.rootDir, row.encrypted_payload)) as TokenSet;
    if (tokenExpired(token)) {
      const clientId = teamsClientId();
      if (!clientId) throw new Error("TEAMS_CLIENT_ID missing; cannot refresh.");
      if (!token.refresh_token) throw new Error("No refresh token. Connect again.");
      token = await refreshAccessToken(teamsTenantId(), clientId, token.refresh_token, this.fetchFn);
      this.storeToken(token);
    }
    return token;
  }
}

function toUser(me: { id: string; displayName?: string; mail?: string; userPrincipalName?: string }): CurrentUser {
  return {
    id: me.id,
    displayName: me.displayName || me.userPrincipalName || me.id,
    email: me.mail || me.userPrincipalName,
  };
}

function chatTitle(chat: { topic?: string | null; chatType?: string; members?: Array<{ displayName?: string }> }): string {
  if (chat.topic && chat.topic.trim()) return chat.topic.trim();
  const names = (chat.members || []).map((m) => m.displayName).filter(Boolean) as string[];
  if (names.length) return names.join(", ");
  return chat.chatType ? `Teams ${chat.chatType}` : "Teams chat";
}

function inferTenant(me: { userPrincipalName?: string }): string | undefined {
  const upn = me.userPrincipalName || "";
  // Tenant GUID is not in /me by default; TEAMS_TENANT_ID must be the directory id for mark-as-read.
  if (/^[0-9a-f-]{36}$/i.test(process.env.TEAMS_TENANT_ID || "")) return process.env.TEAMS_TENANT_ID;
  void upn;
  return process.env.TEAMS_TENANT_ID;
}
