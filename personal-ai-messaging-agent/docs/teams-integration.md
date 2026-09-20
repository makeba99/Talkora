---
cursor:
  subagentId: "bc-8962c22f-882f-5ba7-88ae-6363bb20c3ac"
---

# Microsoft Teams integration

Platform: Microsoft Teams via [Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview)

This connector uses **documented Graph and Entra endpoints only**. Device code flow. No Microsoft password is collected by this app.

## Authentication

Official:

- Device authorization: `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/devicecode`  
  ([device code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code))
- Token: `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`  
  grants `urn:ietf:params:oauth:grant-type:device_code` and `refresh_token`
- Public client desktop registration, **Allow public client flows = Yes**, redirect `http://localhost` if needed  
  ([desktop app registration](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-registration))

The UI shows `verification_uri` (typically `https://microsoft.com/devicelogin`) and `user_code`. The user signs in on Microsoft’s page.

Not used: ROPC username/password, client credentials for live chat send, fake “connected” status without tokens.

Refresh tokens are stored encrypted (AES-256-GCM) in local SQLite `platform_sessions`. They are never returned to the UI or written to `agent_logs`.

## Official API

Implemented against Graph v1.0:

| Operation | HTTP |
| --- | --- |
| Current user | `GET /me?$select=id,displayName,mail,userPrincipalName` |
| List chats | `GET /me/chats?$expand=lastMessagePreview,members&$top=50` ([list chats](https://learn.microsoft.com/en-us/graph/api/chat-list?view=graph-rest-1.0)) |
| Get chat | `GET /chats/{id}` ([get chat](https://learn.microsoft.com/en-us/graph/api/chat-get?view=graph-rest-1.0)) |
| List messages | `GET /chats/{id}/messages?$top=50` ([list messages](https://learn.microsoft.com/en-us/graph/api/chat-list-messages?view=graph-rest-1.0)) |
| Send message | `POST /chats/{id}/messages` with `{ "body": { "contentType": "text", "content": "..." } }` ([send](https://learn.microsoft.com/en-us/graph/api/chat-post-messages?view=graph-rest-1.0)) |
| Mark read | `POST /chats/{id}/markChatReadForUser` with `{ "user": { "id", "tenantId" } }` ([markChatReadForUser](https://learn.microsoft.com/en-us/graph/api/chat-markchatreadforuser?view=graph-rest-1.0)) |

Delegated permissions used: `User.Read`, `Chat.ReadWrite`, `ChatMessage.Send`, plus `offline_access`.

Least-privilege notes from Microsoft Learn:

- List/read chats: delegated `Chat.Read` (we request `Chat.ReadWrite` because mark-as-read needs it).
- Send: delegated `ChatMessage.Send`. Application permission for live send is **not** supported (`Teamwork.Migrate.All` is import/migration only).
- Personal Microsoft accounts: **not supported** on these chat APIs.

## Browser integration

Not required. Device code uses the system browser on Microsoft’s domain. “Open Platform” links to `https://teams.microsoft.com/`.

## Message retrieval

Available when a work/school user has completed device login and Graph returns 200. Conversations and messages are normalized into the shared inbox. HTTP errors are surfaced; empty lists are empty, not fabricated.

Polling `GET /me/chats` + `GET /chats/{id}/messages` is used instead of Graph change notifications (those need a publicly reachable webhook, which this localhost app does not have).

## Message sending

Available only when:

1. Simulation is **off**
2. Live send is **explicitly enabled**
3. Emergency stop is **off**
4. The draft is approved, or Auto is enabled on **both** the Teams platform setting and that conversation

Otherwise `sendMessage(..., { simulate: true })` records a simulated send and **does not** POST to Graph.

Graph 4xx/5xx is stored as `failed`, never as success.

## Limitations

- Work/school account required. Consumer Microsoft accounts cannot use these APIs.
- Tenant admin consent may be required.
- `TEAMS_CLIENT_ID` must be a real Entra public-client application ID. Without it the connector is `not_configured`, not signed in.
- `markChatReadForUser` needs the directory tenant GUID in `TEAMS_TENANT_ID` (not `organizations` / `common`).
- Channel messages in team channels are a different API surface (`/teams/{id}/channels/{id}/messages`) and are not implemented in this first version.
- Creating a brand-new chat is not implemented; send requires an existing chat id from `GET /me/chats`.
- Protected application-permission chat APIs are out of scope (we use delegated user tokens only).

## Required configuration

1. Entra admin center → App registrations → New registration (public client / mobile and desktop).
2. Authentication → Allow public client flows = Yes.
3. API permissions (delegated): `User.Read`, `Chat.ReadWrite`, `ChatMessage.Send`. Admin consent if the tenant requires it.
4. `.env`: `TEAMS_CLIENT_ID=<application id>`, `TEAMS_TENANT_ID=<directory id or organizations>`.
5. Keep `AGENT_DATA_KEY` as a local encryption secret — not a Microsoft password.

## Recommended integration

This Graph delegated path is the legitimate one. Leave simulation on until you have confirmed list/read with your tenant, then enable live send per conversation with Approval mode still default.

Inspected 20 Sep 2026 against Microsoft Learn Graph v1.0 and Entra device-code documentation.
