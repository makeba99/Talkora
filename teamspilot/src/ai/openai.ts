import { AiConfigError, type AiProvider } from "./provider.js";
import { buildChatMessages, type ReplyRequest } from "./prompt.js";

const DEFAULT_BASE = "https://api.openai.com/v1";

export class OpenAiProvider implements AiProvider {
  constructor(
    private readonly options: {
      apiKey: () => Promise<string | null>;
      baseUrl?: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async generateReply(input: ReplyRequest, signal?: AbortSignal): Promise<string> {
    const apiKey = await this.options.apiKey();
    if (!apiKey) throw new AiConfigError("Add an OpenAI API key in Settings.");
    const messages = buildChatMessages(input);
    let response: Response;
    try {
      response = await (this.options.fetchImpl ?? fetch)(`${this.options.baseUrl ?? DEFAULT_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0.4,
          max_tokens: 400,
          messages,
        }),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new AiConfigError("The AI provider could not be reached. Nothing was sent.");
    }
    if (response.status === 401) throw new AiConfigError("The AI provider rejected the API key. Nothing was sent.");
    if (response.status === 429) throw new AiConfigError("The AI provider rate-limited the request. Nothing was sent.");
    if (!response.ok) throw new AiConfigError("The AI provider returned an error. Nothing was sent.");
    const payload = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    const text = readContent(payload.choices?.[0]?.message?.content).trim();
    if (!text) throw new AiConfigError("The AI provider returned an empty reply. Nothing was sent.");
    if (text.length > 4000) throw new AiConfigError("The reply was too long to keep. Nothing was sent. Regenerate or write a shorter one.");
    return text;
  }
}

function readContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
      return "";
    })
    .join("");
}
