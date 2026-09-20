# Personal AI Messaging Agent

Standalone local-first personal messaging assistant. **Not related to Talkora or Vextorn.**

It runs on your computer, binds to **localhost**, stores data in **SQLite**, and never asks for a Google, Microsoft, or Free4Talk password.

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

## How to run

```bash
cp .env.example .env
npm install
npm run test
npm run dev
```

- Desk UI: `http://127.0.0.1:5173`
- API + live status: `http://127.0.0.1:8787` (`/` shows that the process is up; `/api/health` is JSON)

```bash
npm run build
npm start    # production UI served from this same localhost process after build
```

Do not set `HOST` to `0.0.0.0`. The process refuses non-localhost binds.

`127.0.0.1` is **this machine**. Opening it on a different computer will refuse the connection.

## Defaults (safety)

- Operating mode: **Approval**
- **Simulation on**, **live send off**
- Auto-send requires explicit opt-in on the platform **and** the conversation
- `STOP ALL AGENTS` halts dispatch immediately

## Microsoft Teams

Graph chat APIs exist for **work or school** accounts only. Register a public client in Entra, enable **Allow public client flows**, grant delegated `User.Read`, `Chat.ReadWrite`, and `ChatMessage.Send`, then set `TEAMS_CLIENT_ID` in `.env`.

Connect in the UI. You will get a code and `https://microsoft.com/devicelogin`. Sign in on Microsoft’s page. This app never collects your Microsoft password.

## Free4Talk

No official API. **Authorized headed browser only.**

1. In the desk UI, **Connect** — a local Chromium window opens with a persistent profile. Sign in on [free4talk.com](https://www.free4talk.com/) yourself (Google prompt belongs to them).
2. **Room URL** prefills `https://www.free4talk.com/room/z2ee2`. Open that public room page (heroku hosts are rejected). **Monitoring** watches visible ChatBox; it does not click Send while simulation is on.
3. The agent reads currently **visible** public chat from the page DOM. **ReplyEngine** drafts a **companion** line (present, kind, same language — not assistant voice). **Send as signed-in account** / Approve types into the page’s own “Type a message…” box only when Simulation is off, Live send is on, and STOP is off. **AUTO REPLY IS ACTIVE** also requires Free4Talk Auto.

It will not ask for a Google/Free4Talk password, export cookies, decrypt room tokens, sniff websockets, or call undocumented heroku hosts. Simulation (default) types without clicking Send. Off-screen virtualized history and private/PM bubbles are not read.

## Honest limitations

- Free4Talk DMs, voice, and off-screen virtualized chat are not automated. Room send/read only works while you are signed in in the local window and the ChatBox textarea is actually on the page.
- Teams personal Microsoft accounts are not supported by Graph chat APIs.
- This app is not deployed.
