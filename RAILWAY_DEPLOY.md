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
| `SMTP_USER` | `vextornweb@gmail.com` |
| `SMTP_PASS` | From your Replit Secrets panel |

**Optional** (features degrade gracefully without these):

| Variable | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | AI Tutor "Eva" voice |
| `OPENAI_API_KEY` | AI Tutor text responses |
| `TENOR_API_KEY` | GIF search (has free public fallback) |
| `GOOGLE_CLIENT_ID` | Google OAuth login |
| `GOOGLE_CLIENT_SECRET` | Google OAuth login |

### 4. Deploy
Push to your GitHub main branch — Railway builds and deploys automatically.
The start command (`npm run db:push && node dist/index.cjs`) runs DB migrations
before the server starts, so your schema is always up to date.

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
