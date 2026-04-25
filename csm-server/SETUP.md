# Sesame CSM on Modal — Step-by-Step (for Vextorn on Railway)

This is the **simplest free path** to get the AI Tutor's voice running. Total time: ~15 minutes. Cost: **$0** for the first 4–6 months thanks to Modal's $30 signup credit.

You will create accounts on two free services, paste a few values, and run three commands. No coding required.

---

## Step 1 — Hugging Face account + model access (5 min)

The CSM voice model is gated, so you need a Hugging Face account to use it. It's free.

1. Go to **https://huggingface.co/join** and sign up (Google login works).
2. Go to **https://huggingface.co/sesame/csm-1b** and click the big **"Agree and access repository"** button. (You may have to fill in a quick form — name, what you're using it for. "Personal language-learning app" is fine.)
3. Go to **https://huggingface.co/settings/tokens** → click **"New token"** → name it `vextorn` → role **"Read"** → click **Generate**.
4. **Copy the token** (starts with `hf_…`). You won't be able to see it again.

---

## Step 2 — Modal account (3 min)

Modal is the GPU host. They give you $30 free on signup, which covers months of normal usage.

1. Go to **https://modal.com/signup** and sign up (GitHub or Google login).
2. That's it — no payment method needed for the free tier.

---

## Step 3 — Deploy the voice server (5 min)

Open a terminal **on your own computer** (not Replit — Modal's CLI needs to log into your Modal account in a browser). You need Python 3.10+ installed (most computers have it).

Clone this repo somewhere local, then:

```bash
cd csm-server

# install Modal's CLI
pip install modal

# log into Modal (opens browser — click Approve)
modal token new

# tell Modal your Hugging Face token (from Step 1)
modal secret create hf-token HF_TOKEN=hf_PASTE_YOUR_TOKEN_HERE

# (optional but recommended) create a shared password between Vextorn and CSM
modal secret create vextorn-csm-token SESAME_CSM_TOKEN=$(openssl rand -hex 24)
# ↑ copy the value it prints — you'll paste it into Railway in Step 4
# (If you don't want auth, open modal_app.py and comment out the vextorn-csm-token line.)

# deploy!
modal deploy modal_app.py
```

After 1–2 minutes you'll see something like:

```
✓ Created objects.
✓ Created vextorn-csm.fastapi-app
└── 🔗 https://yourname--vextorn-csm-fastapi-app.modal.run
```

**Copy that URL.** That's your `SESAME_CSM_URL`.

Verify it works:

```bash
curl https://yourname--vextorn-csm-fastapi-app.modal.run/healthz
# → {"ok":true,"device":"cuda","model":"sesame/csm-1b","auth_required":true}
```

(First request takes 60–90 sec — Modal is downloading the model. After that, ~1 sec.)

---

## Step 4 — Tell Railway where to find it (2 min)

In your Railway dashboard:

1. Open your Vextorn project → **Variables** tab.
2. Click **"+ New Variable"** twice and add:

| Name | Value |
|---|---|
| `SESAME_CSM_URL` | the `https://...modal.run` URL from Step 3 |
| `SESAME_CSM_TOKEN` | the token you generated in Step 3 (skip if you commented out auth) |

3. Railway will redeploy automatically. Wait ~30 sec.
4. Open your live site → join a room → start AI Tutor → talk to it.

The voice should now sound like Sesame's CSM (much more natural than before). If it still sounds like the old browser voice, see **Troubleshooting** below.

---

## Troubleshooting

**The voice didn't change.**
- Check Railway logs for `[sesame] health check failed`. If you see it, your `SESAME_CSM_URL` is wrong or the Modal app crashed. Test the URL with `curl https://YOUR_URL/healthz`.
- Hard-refresh your browser (the Sesame check is cached on first page load).

**`401 Unauthorized` in Railway logs.**
- Your `SESAME_CSM_TOKEN` on Railway doesn't match the one in Modal. They must be identical.

**First message takes 60+ seconds, then it's fast.**
- Normal — Modal's container was cold. To keep it warm cheaply, increase `container_idle_timeout` in `modal_app.py` from 300 to e.g. 1800 (30 min) and `modal deploy` again.

**Modal says "Repository not found: sesame/csm-1b".**
- You skipped Step 1.2 — go back and click "Agree and access repository" on the model page.

---

## Costs in plain English

- **Idle**: $0 (Modal scales to zero)
- **Per tutor session (5 min, ~60 sentences)**: ~$0.02–0.06
- **First-month free credit**: $30 → roughly **500 hours of active tutor time** before paying anything.

You'll get an email from Modal when your credit is at 25% / 10% / 0%.
