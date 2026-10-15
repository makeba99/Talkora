# TeamsPilot

TeamsPilot is a local Windows application that watches a Microsoft Teams chat you select, drafts a reply with an AI model, and leaves that reply in an inbox until you approve the exact text. It does not send in the background, on a timer, after an error, or after an uncertain result.

The server listens on `127.0.0.1` only. The OpenAI key and the Microsoft token cache stay on this computer. On Windows they go to Credential Manager (the token cache uses DPAPI when it is too large for a credential blob). The desktop window is an Electron shell around that local server.

## What it can and cannot do

Message detection uses delegated Microsoft Graph polling of the chat you select:

- `GET /me/chats`
- `GET /chats/{chat-id}/messages`
- `POST /chats/{chat-id}/messages` only after Approve & Send

Microsoft Graph cannot tell TeamsPilot which chat is open in the Teams desktop window. You choose the chat. On Windows, a UI Automation probe can read the Teams window and suggest a match. It changes the monitored chat on its own only when Teams exposes a selected item that matches exactly one Graph chat. That probe was not verified against an installed Teams build in this repository. It never types, clicks, or presses Enter. UI Automation is not a send path.

Graph change notifications are not used. They are delivered to a public HTTPS endpoint, and this app is local-only. `GET /users/{id}/chats/getAllMessages/delta` is not used either: that API does not support delegated permissions. After a disconnect, TeamsPilot rereads messages newer than the last successful poll, with a two-minute overlap, and follows a backlog link when a poll is truncated. If it cannot reach the previous watermark, the dashboard says detection is incomplete. It does not claim that every incoming message was seen.

The first poll of a chat records the messages already there and does not draft replies for them. Team channel threads are not monitored. Personal Microsoft accounts are not supported for these chat APIs. National clouds are not configured.

If Graph does not confirm a send, the draft becomes **Uncertain**. Nothing retries it. You check Teams and record what you found.

## Permissions

The sign-in requests only these delegated Graph scopes:

- `User.Read`
- `Chat.Read`
- `ChatMessage.Send`

It does not request application permissions or `*.All` permissions. `Chat.ReadWrite` is not requested because `ChatMessage.Send` is the narrower send permission.

In the Graph permissions reference, those delegated permissions are not marked admin-consent-required. The Microsoft-managed user-consent policy still blocks user consent for `Chat.Read` in many tenants. If sign-in fails with a consent error, an administrator grants consent from the app's API permissions page. Do not bypass a tenant policy. Device-code sign-in can also be blocked by conditional access. TeamsPilot will not ask for your Microsoft password and it does not use a client secret.

## Install and run on Windows

1. Install [Node.js 20 or newer](https://nodejs.org).
2. Open a terminal in the `teamspilot` directory.
3. Start the desktop app:

```bat
Start-TeamsPilot.bat
```

That installs dependencies, builds the local UI, and opens the TeamsPilot window. Equivalent commands:

```bat
npm install
npm run app
```

Other commands:

```bat
npm run dev
npm start
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run dev` serves the interface through the local API with live reload. `npm start` serves the production build in a browser at the printed `http://127.0.0.1` address. `npm run app` is the desktop window.

The process binds to `127.0.0.1`. The default port is `47321`. If that port is busy, it uses the next free port and prints the URL.

## Microsoft sign-in

1. In the [Entra admin center](https://entra.microsoft.com), go to **Identity → Applications → App registrations → New registration**.
2. Name it `TeamsPilot`.
3. Supported account types: **Accounts in any organizational directory**. Do not select personal Microsoft accounts.
4. Leave the redirect URI empty. Device-code sign-in does not use one.
5. After registration, open **Authentication → Advanced settings** and set **Allow public client flows** to **Yes**.
6. Open **API permissions → Add a permission → Microsoft Graph → Delegated** and add `User.Read`, `Chat.Read`, and `ChatMessage.Send`. Do not add application permissions.
7. If your tenant blocks user consent for `Chat.Read`, choose **Grant admin consent**. The portal path is the one to use. This app does not complete an admin-consent redirect.
8. Copy the **Application (client) ID**. Do not create a client secret.
9. In TeamsPilot settings, paste the client ID, keep the tenant as `organizations` or set your tenant id, and save.
10. Choose **Sign in with Microsoft**. Open `https://microsoft.com/devicelogin` and enter the code shown in the app.

Optional environment seed, from `.env.example`:

```bat
copy .env.example .env
```

Put the client id in `TEAMSPILOT_GRAPH_CLIENT_ID` if you want. Leave secrets empty in that file.

## OpenAI

1. Open **Settings**.
2. Set the model. The default suggestion is `gpt-4o-mini`. The model is a setting, not a value copied through the code.
3. Choose a style: Professional, Friendly, Casual, Concise, or Detailed.
4. Leave language on **Match the conversation**, or set a fixed language.
5. Paste the API key and choose **Store key**. The key is not returned to the page and is not written into the draft file.

The key is sent only from this computer to `https://api.openai.com`. Incoming Teams messages are wrapped as untrusted data and cannot change the approval rule.

## Review a draft

1. Select the chat on the dashboard and choose **Start**. The status line names that chat. The first poll only sets a baseline.
2. When a later message arrives, a draft appears in the inbox. The activity log does not store the message text unless you turn excerpts on.
3. **Save edit** changes the exact text that can be sent. Unsaved typing is not sent.
4. **Regenerate** asks for a new draft and does not send.
5. **Copy reply** copies the text and does not send.
6. **Discard** prevents sending. Discarding an uncertain draft does not remove a message that may already be in Teams.
7. **Approve & Send** is the only control that may send. It sends the saved text to the draft's original chat after Graph confirms that chat still exists.
8. If the result is **Uncertain**, check Teams. Choose **I checked — it was not sent** or **I checked — it is in the chat**. There is no automatic retry.
9. **Clear drafts and context** deletes local conversation data and resets baselines. It does not delete your Microsoft account or the API key.

Pasting a message in the inbox creates a draft you typed. It is not Teams detection. It can be sent only when it is attached to a chat Graph can verify, and only after Approve & Send.

## Layout

```text
teamspilot/
  src/core/         drafts, settings, recovery
  src/pipeline/     detection and generation; no send method
  src/send/         approval gate and the only Graph write
  src/teams/        Graph reader, polling, UI Automation probe
  src/ai/           replaceable provider; OpenAI is the first one
  src/server/       localhost API
  src/renderer/     inbox, dashboard, settings, activity
  electron/         Windows desktop shell
  tests/            unit and HTTP tests with a fake sender
```

A second Teams integration can implement `TeamsReader`. It must not send. Sending stays behind `MessageSender`, which the approval gate alone calls.

## Tests

From `teamspilot`:

```bat
npm test
npm run typecheck
npm run lint
npm run build
```

The tests use fakes. They do not sign in to Microsoft, call OpenAI, or deliver a Teams message. A passing suite does not mean a message was delivered to a real chat.

On this implementation pass, `npm test` reported 31 passed tests in 3 files (`tests/mandatory.test.ts`, `tests/graph-and-policy.test.ts`, `tests/http.test.ts`). `npm run typecheck`, `npm run lint`, and `npm run build` completed without errors. That run did not include a live Teams desktop session, a Graph send, or an OpenAI call. UI Automation was not verified against an installed Teams client.

## Still required outside this repository

- Node.js 20+ on your PC.
- An Entra app registration, public client flows, and the three delegated permissions. Admin consent if the tenant policy requires it.
- A work or school Teams account that can use those APIs.
- An OpenAI API key and a model you are allowed to call.
- The Teams desktop client, if you want the window probe. The probe is unverified until it returns a result on your machine.
- A packaged installer is not produced here. `npm run app` is the run path. `electron-builder` is not configured, so there is no signed MSIX or EXE in this change.
