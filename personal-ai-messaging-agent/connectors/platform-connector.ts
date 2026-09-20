export type PlatformId = "free4talk" | "teams";

export type ConnectorStatus =
  | "disconnected"
  | "not_configured"
  | "awaiting_user"
  | "connected"
  | "integration_unavailable"
  | "error"
  | "paused";

export type NormalizedMessage = {
  platform: PlatformId;
  externalId: string;
  conversationExternalId: string;
  conversationTitle: string;
  direction: "inbound" | "outbound";
  senderId?: string;
  senderName?: string;
  body: string;
  sentAt: string;
  rawType: string;
};

export type NormalizedConversation = {
  platform: PlatformId;
  externalId: string;
  title: string;
  lastMessageAt?: string;
  unread?: boolean;
  participants?: string[];
};

export type CurrentUser = {
  id: string;
  displayName: string;
  email?: string;
};

export type SendResult = {
  simulated: boolean;
  externalId?: string;
  sentAt: string;
};

export type IntegrationReport = {
  available: boolean;
  reason?: string;
  exists: string[];
  missing: string[];
  canBuild: string[];
  requiredConfig: string[];
};

export class IntegrationUnavailable extends Error {
  readonly code = "INTEGRATION_UNAVAILABLE" as const;
  constructor(
    public platform: PlatformId,
    public operation: string,
    public report: IntegrationReport,
  ) {
    super(report.reason || `Integration unavailable: ${platform} ${operation}`);
    this.name = "IntegrationUnavailable";
  }

  toJSON() {
    return {
      ...this.report,
      code: this.code,
      platform: this.platform,
      operation: this.operation,
      available: false,
    };
  }
}

export type ConnectResult = {
  status: ConnectorStatus;
  message: string;
  currentUser?: CurrentUser;
  deviceLogin?: {
    userCode: string;
    verificationUri: string;
    message: string;
    expiresIn: number;
  };
};

export interface PlatformConnector {
  readonly platform: PlatformId;
  connect(): Promise<ConnectResult>;
  disconnect(): Promise<void>;
  getStatus(): Promise<{
    status: ConnectorStatus;
    message: string;
    currentUser?: CurrentUser;
    integration: IntegrationReport;
    deviceLogin?: ConnectResult["deviceLogin"];
  }>;
  getConversations(): Promise<NormalizedConversation[]>;
  getConversation(externalId: string): Promise<NormalizedConversation | null>;
  getMessages(conversationExternalId: string): Promise<NormalizedMessage[]>;
  watchForNewMessages(onMessage: (message: NormalizedMessage) => void): Promise<() => void>;
  sendMessage(conversationExternalId: string, body: string, options?: { simulate?: boolean }): Promise<SendResult>;
  markAsRead(conversationExternalId: string): Promise<void>;
  getCurrentUser(): Promise<CurrentUser | null>;
  logout(): Promise<void>;
  openPlatform(): Promise<{ url: string }>;
}

export function normalizeMessage(input: NormalizedMessage): NormalizedMessage {
  return {
    ...input,
    body: (input.body || "").replace(/\u0000/g, "").trim(),
    senderName: input.senderName?.trim() || input.senderId || "Unknown",
    sentAt: input.sentAt || new Date().toISOString(),
  };
}
