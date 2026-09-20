# Personal AI Messaging Agent

Local-first personal messaging assistant. It runs on your computer, binds to **localhost**, stores data in **SQLite**, and never asks for a Google, Microsoft, or Free4Talk password.

This directory is the application. It lives alongside the existing Vextorn/Talkora language-exchange app in the repo parent; Replit is not required.

## Layout

```
frontend/                 UI
backend/                  Local HTTP API
agent/                    Draft / approval / auto / emergency stop
connectors/free4talk/     Honest Free4Talk adapter (no invented API)
connectors/teams/         Microsoft Graph device-code connector
ai/                       Shared reply engine (no platform APIs)
database/                 SQLite schema
security/                 Localhost bind, token encryption, redaction
logging/                  Activity log (no secrets)
tests/
```

## How to run locally

```bash
cd personal-ai-messaging-agent
cp .env.example .env
npm install
npm run test
npm run dev
```

Then open `http://127.0.0.1:5173`. The API listens on `http://127.0.0.1:8787`.

```bash
npm run build    # typecheck + production UI build
npm start        # serve API + built UI (after build), still localhost
```

Do not set `HOST` to `0.0.0.0`. The process refuses non-localhost binds.

## Defaults (safety)

- Operating mode: **Approval**
- **Simulation on**, **live send off**
- Auto-send requires explicit opt-in on the platform **and** the conversation
- `STOP ALL AGENTS` halts dispatch immediately

## Microsoft Teams

Graph chat APIs exist for **work or school** accounts only. Register a public client in Entra, enable **Allow public client flows**, grant delegated `User.Read`, `Chat.ReadWrite`, and `ChatMessage.Send`, then set `TEAMS_CLIENT_ID` in `.env`.

Connect in the UI. You will get a code and `https://microsoft.com/devicelogin`. Sign in on Microsoft’s page. This app never collects your Microsoft password.

Live send calls `POST https://graph.microsoft.com/v1.0/chats/{id}/messages` only when simulation is off **and** live send is enabled **and** a draft is approved (or auto is fully opted in).

## Free4Talk

**Integration unavailable** for inbox retrieve and send. Free4Talk has no official public messaging API. Connect can open the real site so you can sign in there yourself. See the integration report in the project docs.

## Optional drafts

Leave `OPENAI_API_KEY` empty to use the on-device heuristic drafter. Set it only if you want OpenAI-compatible draft generation. That key is not a platform login.

## Honest limitations

- Free4Talk DMs and room chat cannot be automated without an unpublished, unofficial protocol. This app will not scrape, intercept cookies, or report a fake send.
- Teams personal Microsoft accounts are not supported by Graph chat APIs.
- `markChatReadForUser` needs your directory tenant GUID in `TEAMS_TENANT_ID`, not `organizations`.
- Polling Graph chats is not the same as a Teams bot with change notifications.
- This app is not deployed. Do not point production DNS at it.
