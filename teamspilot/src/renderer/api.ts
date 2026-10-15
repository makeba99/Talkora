export interface Draft {
  id: string;
  sourceMessageId: string;
  chatId: string;
  chatLabel: string;
  senderLabel: string;
  originalMessage: string;
  context: { id: string; senderLabel: string; text: string; mine: boolean }[];
  generatedReply: string;
  currentReply: string;
  revision: number;
  createdAt: string;
  status: string;
  error?: string;
  source: "teams" | "manual";
  delivery?: { kind: "graph" | "user"; providerMessageId?: string };
}

export interface Status {
  monitoring: "stopped" | "running" | "paused";
  mode: "draft-only" | "monitoring";
  draftOnlyReason: string | null;
  guaranteesAllIncomingMessages: false;
  detectionSummary: string;
  sendPolicy: string;
  account: { signedIn: boolean; displayName: string | null };
  graphConfigured: boolean;
  openaiConfigured: boolean;
  monitoredChat: { id: string; label: string } | null;
  pendingReviewCount: number;
  lastError: string | null;
  lastPollAt: string | null;
  detectionTruncated: boolean;
  lastProbe: Probe | null;
  followTeamsWindow: boolean;
  uiaSupported: boolean;
  uiaSending: false;
  dataDir: string;
  bind: "127.0.0.1";
}

export interface Probe {
  supported: boolean;
  teamsWindowFound: boolean;
  confidence: "none" | "low" | "high";
  suggestedChatId: string | null;
  suggestedLabel: string | null;
  messageTextExposed: boolean;
  composerFound: boolean;
  canSendThroughUi: false;
  notes: string[];
}

export interface Settings {
  model: string;
  style: string;
  languageMode: "match" | "fixed";
  fixedLanguage: string;
  pollIntervalMs: number;
  logMessageContent: boolean;
  followTeamsWindow: boolean;
  monitoredChatId: string | null;
  monitoredChatLabel: string;
  graphClientId: string;
  graphTenant: string;
  openaiConfigured?: boolean;
}

export interface Chat {
  id: string;
  label: string;
  chatType: string;
}

export interface Activity {
  id: string;
  at: string;
  level: "info" | "error";
  event: string;
  draftId?: string;
  chatId?: string;
  detail?: string;
  status?: string;
  outcome?: string;
}

export interface AuthState {
  configured: boolean;
  signedIn: boolean;
  account: { displayName: string; username: string } | null;
  pending: { userCode: string; verificationUri: string; message: string } | null;
  lastError: string | null;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      "X-TeamsPilot-Request": "1",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data as T;
}

export function subscribe(onEvent: (event: { type?: string }) => void): () => void {
  const source = new EventSource("/api/events");
  source.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as { type?: string });
    } catch {
      onEvent({});
    }
  };
  return () => source.close();
}
