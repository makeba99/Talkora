# Deploying Vextorn on Railway

## One-time setup (5 minutes)

### 1. Create a new Railway project
Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → select this repo.

### 2. Add a PostgreSQL database
In your Railway project → New → Database → PostgreSQL.
Railway will auto-inject `DATABASE_URL` into your service.

### 3. Set environment variables
In Railway → your service → Variables tab, add every variable from `.env.railway`.

Use the table below — copy the values from your Replit Secrets panel for the sensitive ones:

| Variable | Where to get it |
|---|---|
| `NODE_ENV` | `production` (literal) |
| `DATABASE_URL` | Use Railway reference: `${{Postgres.DATABASE_URL}}` |
| `SESSION_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `REPL_ID` | Replit → your Repl → URL (the ID after `/repl/`) or Secrets tab |
| `REPLIT_DOMAINS` | Your Railway domain e.g. `vextorn.up.railway.app` |
| `CALLBACK_URL` | `https://vextorn.up.railway.app/api/auth/callback` |
| `VAPID_PUBLIC_KEY` | Optional — if unset, auto-generated & stored in `app_settings`. For multi-instance, set the same keys on every replica (`npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Optional — pair with `VAPID_PUBLIC_KEY`; never expose to the client |
| `SMTP_USER` | `a46947314@gmail.com` |
| `SMTP_PASS` | Gmail App Password (16 characters, no spaces) |
| `SMTP_FROM_NAME` | `Hello Vextorn` (inbox display name) |

**Optional** (features degrade gracefully without these):

| Variable | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | AI Tutor "Eva" voice |
| `OPENAI_API_KEY` | AI Tutor text responses |
| `HF_TOKEN` | Optional leftover only. **Skip for live CSM.** Fine-grained HF tokens can have an expiry date — do not use those. |
| `DEEPINFRA_TOKEN` | Direct DeepInfra GPU for sesame/csm-1b (~$7 / 1M characters). Account API key — **no calendar expiry**. Add a card / auto recharge so 402 never hits. |
| `FAL_KEY` | fal.ai key for **fal-ai/csm-1b** (~$0.03 / 1k characters). Account API key — **no calendar expiry**. Enable auto top-up. |
| `AI_VOICE_PROVIDER` | `edge` (default), `openai`, `browser`, or `sesame` |
| `TENOR_API_KEY` | GIF search (has free public fallback) |
| `GOOGLE_CLIENT_ID` | Google OAuth login |
| `GOOGLE_CLIENT_SECRET` | Google OAuth login |

### 4. Deploy
Push to your GitHub main branch — Railway builds and deploys automatically.
The start command is `node dist/index.cjs`. A typical deploy should finish in a few minutes (not 20). The previous 20-minute builds were Brotli q11 over every JS bundle.

**Completely free voice:** set `AI_VOICE_PROVIDER=edge` (or leave unset). Maya/Miles speak with Microsoft Edge neural voices (Ava / Andrew). No API key. This is the only $0 path that is not the robotic device voice.

**Sesame CSM-1B** needs `FAL_KEY` or `DEEPINFRA_TOKEN` (paid GPU). Set **both** so one host can fail over. Those keys do not expire by date; they stop when credits run out (HTTP 402) or you delete/rotate the key. Admin → AI Tutor shows live Sesame GPU status and alerts on 402/401. Rooms still speak Edge if GPU dies. The public Hugging Face Space is never called.

### 5. Verify
- Visit your Railway domain — you should see the Vextorn lobby
- `/api/health` should return `{"status":"ok"}`
- Sign in works via Replit OAuth
- Admin → Outreach → Web Push: subscriber count visible
- Admin → Outreach → Email: send a test to yourself

## Re-deploying after changes
Just push to GitHub. Railway rebuilds and re-runs migrations automatically.

## Updating environment variables
Change them in Railway → Variables — Railway restarts the service automatically.
No code changes needed.
