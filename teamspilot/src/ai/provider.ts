import type { ReplyRequest } from "./prompt.js";

export interface AiProvider {
  generateReply(input: ReplyRequest, signal?: AbortSignal): Promise<string>;
}

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}
