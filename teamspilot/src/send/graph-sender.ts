import { safeGraphErrorCode, type GraphRequest } from "../teams/graph-request.js";
import { UNCERTAIN_DETAIL, type DeliverResult, type MessageSender } from "./sender.js";

const NOT_CREATED = new Set([400, 401, 403, 404]);

/**
 * The only Microsoft Graph write in the application.
 * One HTTP request. No retry.
 */
export class GraphMessageSender implements MessageSender {
  constructor(private readonly graph: GraphRequest) {}

  async deliver(input: { draftId: string; chatId: string; text: string }): Promise<DeliverResult> {
    let response;
    try {
      response = await this.graph.request("POST", `/chats/${encodeURIComponent(input.chatId)}/messages`, {
        body: { contentType: "text", content: input.text },
      });
    } catch {
      return { outcome: "uncertain", detail: UNCERTAIN_DETAIL };
    }
    const code = safeGraphErrorCode(response.body);
    const suffix = code ? ` (${code})` : "";
    if ((response.status === 200 || response.status === 201) && response.body && typeof response.body === "object") {
      const id = (response.body as { id?: unknown }).id;
      if (typeof id === "string" && id.trim()) {
        return {
          outcome: "sent",
          providerMessageId: id,
          acceptedText: input.text,
          acceptedChatId: input.chatId,
        };
      }
      return { outcome: "uncertain", detail: UNCERTAIN_DETAIL };
    }
    if (NOT_CREATED.has(response.status)) {
      return { outcome: "failed", detail: `Microsoft Graph rejected the message${suffix}. Nothing was sent.` };
    }
    return { outcome: "uncertain", detail: `${UNCERTAIN_DETAIL} Graph returned HTTP ${response.status}${suffix}.` };
  }
}
