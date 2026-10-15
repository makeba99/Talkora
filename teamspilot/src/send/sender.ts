export type DeliverResult =
  | { outcome: "sent"; providerMessageId: string; acceptedText: string; acceptedChatId: string }
  | { outcome: "failed"; detail: string }
  | { outcome: "uncertain"; detail: string };

export interface MessageSender {
  deliver(input: { draftId: string; chatId: string; text: string }): Promise<DeliverResult>;
}

export const UNCERTAIN_DETAIL =
  "The send ended without confirmation from Microsoft Graph. The message may or may not be in the chat. Check Teams. TeamsPilot will not retry automatically.";
