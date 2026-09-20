# Free4Talk integration

Platform: [Free4Talk](https://www.free4talk.com/)

**No official API.** This app does not invent endpoints, decrypt room tokens, sniff unpublished websockets, scrape Heroku hosts, intercept cookies, or report a fake send.

**Authorized headed browser** is implemented for **one pasted public room URL** while **you** are signed in on free4talk.com.

Hilda’s room for Try Live: `https://www.free4talk.com/room/z2ee2`. The desk **Room URL** field prefills that exact `www.free4talk.com` path. `*.herokuapp.com` and `identity.free4talk.com` are rejected.

## How you paste a URL

1. In the desk UI (`/free4talk`) click **Connect**. A local headed Chromium window opens with a persistent profile under `data/free4talk-profile` (gitignored). Cookies stay in that profile and are never copied into logs.
2. Sign in on **their** Google prompt (“Sign in to continue to Free4Talk”). This app never asks for a Google or Free4Talk password.
3. Join a group in that window. Copy the address bar: `https://www.free4talk.com/room/<roomId>`.
4. Paste it into **Room URL** (or keep the z2ee2 prefill) and click **Open room**. Only `https://www.free4talk.com/room/…` (or `free4talk.com`) is accepted.

Homepage room cards do **not** expose `<a href="/room/…">`. “Join and talk now!” while signed out only opens the sign-in modal; it does not navigate.

On API process start the headed session opens `https://www.free4talk.com/room/z2ee2` and turns **Monitoring ON**. It does **not** turn Free4Talk Auto on. Default remains simulation on / live send off, so Send is not clicked.

## Companion voice

ReplyEngine writes like a **present, kind companion** in the room — not a bot or assistant.

- Uses the **full currently visible** public ChatBox as context (snapshot of `.message[data-message-id]` nodes, not an invented inbox API).
- Same language as the latest inbound. One or two short natural lines.
- No “great question”, “happy to help”, “thanks for writing”, or other assistant wrap-up.
- No invented personal facts (memories, names, that you were physically somewhere).
- **Skip** when no reply is needed (acks like “Thanks, Got it.”, fragments, automated/no-reply, duplicate lines).

On each **new public inbound** (not self, not PM): generate immediately. If Simulation is off **and** Live send is on **and** STOP is off **and** Free4Talk monitoring **and** Free4Talk Auto: type into ChatBox and click Send as the signed-in account. Otherwise a **pending draft** on the desk with the companion text plus **Why this reply** — Approve uses the same ChatBox path.

Desk `/free4talk` shows that companion card and **AUTO REPLY IS ACTIVE** only when the live-send path is armed.

### How Hilda turns companion auto-send on

Leave Monitoring ON (it starts on for z2ee2). Then, in order:

1. Settings (or the Free4Talk page): **Simulation off**.
2. **Live send ENABLED**.
3. Confirm **STOP ALL AGENTS** is off.
4. Free4Talk **Auto ON**.

All four plus monitoring must be true or Send is not clicked. Default remains simulation — drafts only.

## Live monitor + answer


**Monitoring ON** watches the signed-in ChatBox (1.5s poll + page MutationObserver). New inbound public `.message[data-message-id]` nodes (not own, not PM, not empty virtualized placeholders) go through ReplyEngine.

- Default: pending draft. Simulation types-then-clears only if you explicitly Simulate; live monitor itself does not type into the public room.
- Auto-type + click Send only when **all** of: Free4Talk Auto ON, Simulation OFF, Live send ON, STOP ALL AGENTS OFF.
- Otherwise a pending draft. Desk shows **AUTO REPLY IS ACTIVE** only when that full live-send path is armed.
- **STOP ALL AGENTS** kills sending immediately; monitoring can stay on and still only draft.

No invented `/messages` API. No heroku host. No cookie export.

## What the room UI actually allows

Inspected 20 Sep 2026 with headed Playwright against the live site, including **https://www.free4talk.com/room/z2ee2** (ChatBox visible, “Type a message…” input present).

Exists in the **room ChatBox** (bundle names `ChatBox`, `ChatBoxInput`, `ChatBoxMessages`):

- A real `<textarea>` in `.input-send-box`, placeholder **“Type a message… Type @ to mention someone.”**
- A **Send** control `.send-box`, disabled until a signed-in session (`hasJwk`) and until there is text.
- Visible messages as `.message[data-message-id]` with `.text.main-content` and `.name .username`.
- Enter keypress is wired to send on that textarea.

Exists on the **public site without login**:

- Homepage listing. Google Sign-In popup to `accounts.google.com`.
- Homepage “Join and talk now!” while signed out only opens the welcome modal.

Not used / not possible from here:

- Official inbox, DM, or send REST API.
- Reading off-screen history: unviewed `ChatBoxMessageItem` nodes are height placeholders.
- Private/PM bubbles (`.pm-mode`) — skipped on purpose.
- Voice / WebRTC “talk”.
- Decrypting room tokens, posting to undocumented `/messages`, or calling `free4talk-*.herokuapp.com`.

If Google Sign-In is still needed, the headed window stays open for Try Live (`awaiting_user`). Retrieve/send return Integration unavailable until the “Type a message…” box is present and not disabled.

## Message sending

**Send-back uses the signed-in room account**, not an API. Live send types into the page’s own textarea and clicks `.send-box`. Own ChatBox bubbles omit the username row; those are stored as **outbound**.

Default **simulation** types then clears the box and does **not** click Send. **Send as signed-in account** and live auto-reply both refuse to click Send until Simulation is off, Live send is on, and STOP is off.

## Required configuration

None besides Playwright Chromium. Do not paste passwords into `.env`.

Inspected 20 Sep 2026: live homepage, live Google Sign-In popup, live `https://www.free4talk.com/room/z2ee2` ChatBox, `robots.txt`, public chunks. Screenshots: `/cursor/stores/bc-f656d379-f884-4f88-b220-1f2fcee9c42e/media/free4talk-live.png`, `/cursor/stores/bc-f656d379-f884-4f88-b220-1f2fcee9c42e/media/free4talk-companion.png`.
