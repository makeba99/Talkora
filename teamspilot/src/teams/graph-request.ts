export interface GraphResponse {
  status: number;
  body: unknown;
}

export interface GraphRequest {
  request(method: "GET" | "POST", path: string, body?: unknown, signal?: AbortSignal): Promise<GraphResponse>;
}

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

export class AuthorizedGraphRequest implements GraphRequest {
  constructor(
    private readonly token: () => Promise<string>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async request(method: "GET" | "POST", path: string, body?: unknown, signal?: AbortSignal): Promise<GraphResponse> {
    if (!path.startsWith("/")) throw new Error("Graph path was rejected.");
    const accessToken = await this.token();
    const response = await this.fetchImpl(`${GRAPH_ROOT}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (!text) return { status: response.status, body: null };
    try {
      return { status: response.status, body: JSON.parse(text) as unknown };
    } catch {
      return { status: response.status, body: null };
    }
  }
}

export function safeGraphErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const code = (body as { error?: { code?: unknown } }).error?.code;
  return typeof code === "string" && /^[A-Za-z0-9.]{1,80}$/.test(code) ? code : null;
}
