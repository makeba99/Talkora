export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
export const LOGIN_BASE = "https://login.microsoftonline.com";

export const TEAMS_SCOPES = [
  "offline_access",
  "User.Read",
  "Chat.ReadWrite",
  "ChatMessage.Send",
].join(" ");

export type TokenSet = {
  token_type: string;
  scope?: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  obtained_at: number;
};

export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
};

export type GraphUser = {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
};

export type GraphChat = {
  id: string;
  topic?: string | null;
  chatType?: string;
  lastUpdatedDateTime?: string;
  lastMessagePreview?: { createdDateTime?: string; body?: { content?: string } };
  members?: Array<{ displayName?: string; userId?: string; email?: string }>;
};

export type GraphChatMessage = {
  id: string;
  createdDateTime?: string;
  from?: { user?: { id?: string; displayName?: string } };
  body?: { content?: string; contentType?: string };
  messageType?: string;
};

type FetchFn = typeof fetch;

export class GraphError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "GraphError";
  }
}

function form(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}

export async function requestDeviceCode(
  tenant: string,
  clientId: string,
  fetchFn: FetchFn = fetch,
): Promise<DeviceCodeResponse> {
  const res = await fetchFn(`${LOGIN_BASE}/${tenant}/oauth2/v2.0/devicecode`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ client_id: clientId, scope: TEAMS_SCOPES }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new GraphError(res.status, json.error || "device_code_failed", json.error_description || "Device code request failed", json);
  }
  return json as DeviceCodeResponse;
}

export async function pollDeviceToken(
  tenant: string,
  clientId: string,
  deviceCode: string,
  fetchFn: FetchFn = fetch,
): Promise<TokenSet | { pending: true; error: string }> {
  const res = await fetchFn(`${LOGIN_BASE}/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: clientId,
      device_code: deviceCode,
    }),
  });
  const json = (await res.json()) as any;
  if (json.error === "authorization_pending") return { pending: true, error: json.error };
  if (json.error === "slow_down") return { pending: true, error: json.error };
  if (!res.ok) {
    throw new GraphError(res.status, json.error || "token_failed", json.error_description || "Token request failed", json);
  }
  return { ...json, obtained_at: Date.now() } as TokenSet;
}

export async function refreshAccessToken(
  tenant: string,
  clientId: string,
  refreshToken: string,
  fetchFn: FetchFn = fetch,
): Promise<TokenSet> {
  const res = await fetchFn(`${LOGIN_BASE}/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
      scope: TEAMS_SCOPES,
    }),
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new GraphError(res.status, json.error || "refresh_failed", json.error_description || "Refresh failed", json);
  }
  return { ...json, obtained_at: Date.now() } as TokenSet;
}

async function graphFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit,
  fetchFn: FetchFn,
): Promise<T> {
  const res = await fetchFn(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error || {};
    throw new GraphError(res.status, err.code || "graph_error", err.message || `Graph ${res.status}`, json);
  }
  return json as T;
}

export async function getMe(accessToken: string, fetchFn: FetchFn = fetch): Promise<GraphUser> {
  return graphFetch<GraphUser>(
    accessToken,
    "/me?$select=id,displayName,mail,userPrincipalName",
    { method: "GET" },
    fetchFn,
  );
}

export async function listChats(accessToken: string, fetchFn: FetchFn = fetch): Promise<GraphChat[]> {
  const out: GraphChat[] = [];
  let path: string | null =
    "/me/chats?$expand=lastMessagePreview,members&$top=50&$orderby=lastMessagePreview/createdDateTime desc";
  while (path) {
    const relative = path.startsWith("http") ? path.replace(GRAPH_BASE, "") : path;
    const page: { value: GraphChat[]; "@odata.nextLink"?: string } = await graphFetch(
      accessToken,
      relative,
      { method: "GET" },
      fetchFn,
    );
    out.push(...(page.value || []));
    path = page["@odata.nextLink"] ? page["@odata.nextLink"].replace(GRAPH_BASE, "") : null;
    if (out.length >= 200) break;
  }
  return out;
}

export async function getChat(accessToken: string, chatId: string, fetchFn: FetchFn = fetch): Promise<GraphChat> {
  const encoded = encodeURIComponent(chatId);
  return graphFetch<GraphChat>(accessToken, `/chats/${encoded}`, { method: "GET" }, fetchFn);
}

export async function listChatMessages(
  accessToken: string,
  chatId: string,
  fetchFn: FetchFn = fetch,
): Promise<GraphChatMessage[]> {
  const encoded = encodeURIComponent(chatId);
  const page = await graphFetch<{ value: GraphChatMessage[] }>(
    accessToken,
    `/chats/${encoded}/messages?$top=50`,
    { method: "GET" },
    fetchFn,
  );
  return page.value || [];
}

export async function sendChatMessage(
  accessToken: string,
  chatId: string,
  body: string,
  fetchFn: FetchFn = fetch,
): Promise<GraphChatMessage> {
  const encoded = encodeURIComponent(chatId);
  return graphFetch<GraphChatMessage>(
    accessToken,
    `/chats/${encoded}/messages`,
    { method: "POST", body: JSON.stringify({ body: { contentType: "text", content: body } }) },
    fetchFn,
  );
}

export async function markChatRead(
  accessToken: string,
  chatId: string,
  userId: string,
  tenantId: string,
  fetchFn: FetchFn = fetch,
): Promise<void> {
  const encoded = encodeURIComponent(chatId);
  await graphFetch<void>(
    accessToken,
    `/chats/${encoded}/markChatReadForUser`,
    {
      method: "POST",
      body: JSON.stringify({ user: { id: userId, tenantId } }),
    },
    fetchFn,
  );
}

export function tokenExpired(token: TokenSet, skewMs = 60_000): boolean {
  return Date.now() >= token.obtained_at + token.expires_in * 1000 - skewMs;
}

export function htmlToText(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
