# connectmav / Vextorn

This repository still contains the Vextorn (Talkora) language-exchange web app (`client/`, `server/`). That product is Replit/Railway oriented and is **not** the Personal AI Messaging Agent.

## Personal AI Messaging Agent (local-first)

A separate local app lives in [`personal-ai-messaging-agent/`](./personal-ai-messaging-agent) with this layout:

`frontend/` `backend/` `agent/` `connectors/free4talk/` `connectors/teams/` `ai/` `database/` `security/` `logging/` `tests/`

```bash
cd personal-ai-messaging-agent
cp .env.example .env
npm install
npm run test
npm run dev
```

Open `http://127.0.0.1:5173`. Default mode is **Approval**. Simulation is on. Live send is off. Never put Google/Microsoft/Free4Talk passwords in `.env`.

From the repo root you can also run:

```bash
npm run agent:dev
npm run agent:test
npm run agent:build
```

## Legacy Vextorn app

```bash
npm install
npm run dev          # existing Talkora/Vextorn server
npm test             # existing Vextorn unit tests
```
