---
cursor:
  subagentId: "bc-8962c22f-882f-5ba7-88ae-6363bb20c3ac"
---

# Free4Talk integration

Platform: [Free4Talk](https://www.free4talk.com/)

**Integration unavailable** for message retrieval and sending. This app does not invent endpoints, intercept cookies, or report a fake send.

## Authentication

What exists:

- Public login route `https://www.free4talk.com/login` (same SPA shell as the homepage; `robots.txt` disallows `/login` and `/room/`).
- Google Sign-In in the public frontend (`501568857108-cvu8lpq1a1q7424djkiastm38h0v3oji.apps.googleusercontent.com` appears in `main.*.chunk.js`). The Google prompt belongs to Free4Talk, not to this agent.
- `X-Frame-Options: SAMEORIGIN` and a frame-busting script, so the site cannot be embedded.
- Host `identity.free4talk.com` exists (Cloudflare/Heroku). An unauthenticated `GET /identity/get/me/` returns **404 Not Found**. There is no published identity API contract.

What does not exist:

- Official OAuth app registration for third-party clients.
- A documented way for this agent to accept a Free4Talk token.
- Any reason to collect a Google or Free4Talk password. This app will not ask for one.

What can be built:

- **Open Platform** → `https://www.free4talk.com/`.
- Optional headed Playwright window so the user signs in on Free4Talk’s own page. Session files stay in a local profile directory and are never written to activity logs.

Required configuration: none that is legitimate today. Do not paste passwords into `.env`.

## Official API

None. No developer portal, no OpenAPI, no documented REST/GraphQL inbox.

The public bundle builds undocumented per-room hosts of the form `https://free4talk-{name}.herokuapp.com/{id}` and `https://{name}.free4talk.com/`. Those are not a supported messaging API.

Third-party GitHub scrapers and room-token decryptors exist. They are not official, they change, and this connector does not use them.

(Free4Chat at `https://www.free4.chat/` is a different product with an MCP room API. It is not Free4Talk.)

## Browser integration

Possible: open Chromium to the real site for a user-owned login.

Not used: DOM scraping of DMs, WebSocket sniffing, cookie export, CAPTCHA bypass.

## Message retrieval

**Unavailable.** There is no documented conversations or messages endpoint. `getConversations` / `getMessages` throw `IntegrationUnavailable` instead of returning dummy threads.

## Message sending

**Unavailable.** There is no documented send endpoint. Simulation cannot dry-run a send that has no API. `sendMessage` throws `IntegrationUnavailable` even with `simulate: true`.

## Limitations

- Voice rooms, in-room chat, and private messages on Free4Talk cannot be driven by this agent without reverse-engineering an unpublished protocol.
- Cloudflare and anti-bot controls must not be bypassed.
- A local browser session is not the same as an API login.

## Required configuration

None for retrieve/send. Playwright Chromium is optional only to open the website.

## Recommended integration

Keep the connector as an honest unavailable adapter plus “Open Platform”. If Free4Talk publishes a user-authorized API, implement that documented contract behind the shared `PlatformConnector` interface. Until then, use Microsoft Teams (Graph) for actual message retrieve/send.

Inspected 20 Sep 2026: homepage HTML, `robots.txt`, `asset-manifest.json`, `main.5512e07b.chunk.js`, `6.1b97a023.chunk.js`, `identity.free4talk.com`.
