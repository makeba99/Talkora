export const DRAFT_STATUSES = [
  "detected",
  "generating",
  "pending_review",
  "editing",
  "sending",
  "sent",
  "failed",
  "uncertain",
  "discarded",
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const COMMUNICATION_STYLES = ["professional", "friendly", "casual", "concise", "detailed"] as const;
export type CommunicationStyle = (typeof COMMUNICATION_STYLES)[number];

export const RECOMMENDED_MODEL = "gpt-4o-mini";

export const DETECTION_SUMMARY =
  "TeamsPilot polls Microsoft Graph for new messages in the chat you select. It does not receive a live feed from the Teams window, and it cannot guarantee that every incoming message is detected.";

export const SEND_POLICY =
  "No message is sent unless you click Approve & Send for that exact draft. Automatic sending cannot be enabled.";

export const LIMITATIONS = [
  DETECTION_SUMMARY,
  "Microsoft Graph cannot tell this app which chat is open in the Teams window. You select the chat to monitor. On Windows, a UI Automation probe can suggest a match. It follows the on-screen chat only when Teams exposes a selected chat item that matches exactly one Graph chat. That probe was not verified against an installed Teams build in this project, and it never types, clicks, or sends.",
  "Graph change notifications are not used. They are delivered to a public HTTPS address, which a local-only app does not have. After a disconnect, TeamsPilot rereads messages newer than the last successful poll, with a two-minute overlap. If the gap is larger than the pages it can read, it reports incomplete detection instead of claiming success.",
  "The first poll of a chat records messages already there and does not draft replies for them. Drafts are for messages that arrive after that baseline.",
  "Personal Microsoft accounts are not supported by the chat message APIs this app calls. Use a work or school account.",
  "Team channel threads are not monitored. This version uses the chat APIs for 1:1 and group chats only.",
  "Approve & Send creates the message through Microsoft Graph. TeamsPilot does not type into the Teams composer and does not press Enter.",
  "If Graph does not confirm delivery, the draft is marked Uncertain and is not retried.",
] as const;

export interface Settings {
  model: string;
  style: CommunicationStyle;
  languageMode: "match" | "fixed";
  fixedLanguage: string;
  pollIntervalMs: number;
  logMessageContent: boolean;
  followTeamsWindow: boolean;
  monitoredChatId: string | null;
  monitoredChatLabel: string;
  graphClientId: string;
  graphTenant: string;
}

export interface NormalizedMessage {
  id: string;
  idSource: "graph" | "fallback" | "manual";
  chatId: string;
  senderId: string;
  senderLabel: string;
  text: string;
  createdAt: string;
  mine: boolean;
}

export interface ApprovalRecord {
  id: string;
  draftId: string;
  revision: number;
  text: string;
  textSha256: string;
  chatId: string;
  sourceMessageId: string;
  createdAt: string;
  consumed: boolean;
  outcome: "pending" | "sent" | "failed" | "uncertain" | "cancelled";
}

export interface DeliveryRecord {
  kind: "graph" | "user";
  providerMessageId?: string;
  confirmedAt: string;
}

export interface Draft {
  id: string;
  sourceMessageId: string;
  chatId: string;
  chatLabel: string;
  senderId: string;
  senderLabel: string;
  originalMessage: string;
  context: NormalizedMessage[];
  contextFingerprint: string;
  generatedReply: string;
  currentReply: string;
  revision: number;
  generation: number;
  createdAt: string;
  updatedAt: string;
  status: DraftStatus;
  error?: string;
  approval?: ApprovalRecord;
  delivery?: DeliveryRecord;
  source: "teams" | "manual";
}

export interface ActivityEntry {
  id: string;
  at: string;
  level: "info" | "error";
  event: string;
  draftId?: string;
  chatId?: string;
  detail?: string;
  status?: string;
  outcome?: string;
  httpStatus?: number;
  count?: number;
}

export interface ChatCursor {
  primed: boolean;
  watermark: string;
  backlogPath: string | null;
}

export interface ChatSummary {
  id: string;
  label: string;
  chatType: string;
}

export interface AppState {
  version: 1;
  drafts: Draft[];
  processedIds: string[];
  cursors: Record<string, ChatCursor>;
  settings: Settings;
  activity: ActivityEntry[];
}

export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}
