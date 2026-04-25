# Sesame CSM Inference Server (for Vextorn AI Tutor)

This is the **GPU side** of Vextorn's AI Tutor voice. Vextorn (running on Replit) does **not** run CSM — it calls this server over HTTPS for every sentence the AI speaks. CSM-1B needs a GPU (~4 GB VRAM minimum) and gated Hugging Face weights, so it has to run separately.

If this server isn't running (or `SESAME_CSM_URL` isn't set on Vextorn), the AI Tutor automatically falls back to the browser's built-in `speechSynthesis` — no errors surfaced to users.

---

## What it exposes

| Method | Path        | Purpose                                                          |
|--------|-------------|------------------------------------------------------------------|
| GET    | `/healthz`  | Liveness probe — Vextorn pings this once per app load            |
| POST   | `/v1/tts`   | Generate speech audio from text (returns `audio/wav` bytes)      |

`/v1/tts` request body:

```json
{
  "text": "Hey, how's your day going?",
  "speaker": 0,
  "voice": "Female",
  "speed": 1.0,
  "language": "en",
  "max_audio_length_ms": 10000,
  "format": "wav"
}
```

Optional auth: `Authorization: Bearer <SESAME_CSM_TOKEN>` (set the env var on **both** sides).

---

## Prerequisites

1. A GPU host (T4 / A10 / A100 / 4090 / M-series Mac all work). CPU runs but is far too slow for interactive use.
2. **Hugging Face access to `sesame/csm-1b`**. The weights are gated:
   - Visit https://huggingface.co/sesame/csm-1b and accept the license.
   - Run `huggingface-cli login` (or set `HF_TOKEN`) on the GPU host.
3. Python 3.10+.

---

## Quick start (bare-metal / VM)

```bash
git clone https://github.com/your-org/vextorn.git
cd vextorn/csm-server

python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# auth for gated weights
export HF_TOKEN=hf_xxx
# optional: require a bearer token from Vextorn
export SESAME_CSM_TOKEN=$(openssl rand -hex 24)

uvicorn server:app --host 0.0.0.0 --port 8000
```

Verify:

```bash
curl http://localhost:8000/healthz
# → {"ok":true,"device":"cuda","model":"sesame/csm-1b","auth_required":true}

curl -X POST http://localhost:8000/v1/tts \
  -H "Authorization: Bearer $SESAME_CSM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world","speaker":0,"voice":"Female"}' \
  --output hello.wav
```

---

## Deploy to Modal (recommended — zero-ops, scale-to-zero GPU)

Create `modal_app.py` next to `server.py`:

```python
import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install_from_requirements("requirements.txt")
)

app = modal.App("vextorn-csm", image=image, secrets=[modal.Secret.from_name("hf-token")])

@app.function(gpu="A10G", timeout=600, container_idle_timeout=300, memory=16384)
@modal.asgi_app()
def fastapi_app():
    from server import app as fastapi
    return fastapi
```

Then:

```bash
modal secret create hf-token HF_TOKEN=hf_xxx
modal deploy modal_app.py
# → https://your-org--vextorn-csm-fastapi-app.modal.run
```

Set that URL as `SESAME_CSM_URL` on Vextorn.

---

## Deploy to RunPod / Vast.ai (Docker)

`Dockerfile`:

```dockerfile
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04
RUN apt-get update && apt-get install -y python3 python3-pip git ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip3 install -r requirements.txt
COPY server.py .
ENV PORT=8000
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build, push to a registry, deploy on a GPU pod. Inject `HF_TOKEN` and (optionally) `SESAME_CSM_TOKEN` as env vars in the RunPod template.

---

## Wiring it into Vextorn

On the Vextorn side (this Replit project), set two secrets:

| Secret              | Value                                                | Required |
|---------------------|------------------------------------------------------|----------|
| `SESAME_CSM_URL`    | The public URL of this server (no trailing slash)    | yes      |
| `SESAME_CSM_TOKEN`  | Same value as above (matches `Authorization: Bearer`)| optional |

Restart the Vextorn workflow. The AI Tutor will now route TTS through CSM instead of browser speech. Test by joining a room → starting AI Tutor → talking to it. Expect 800–1500 ms first-audio latency on an A10/A100 with cold caches, ~400 ms warm.

---

## Troubleshooting

| Symptom                                  | Cause / Fix                                                                                     |
|------------------------------------------|-------------------------------------------------------------------------------------------------|
| AI Tutor speaks with the same browser voice as before | `SESAME_CSM_URL` not set, or `/healthz` not reachable. Check Vextorn server logs.       |
| `/healthz` returns 401                   | `SESAME_CSM_TOKEN` mismatch between Vextorn and CSM server.                                     |
| First request takes 30+ seconds          | Cold container — Modal/RunPod scale-to-zero. Increase idle timeout or send a keep-warm ping.    |
| `OutOfMemoryError`                       | GPU too small. CSM-1B needs ~4 GB; concurrent requests need more. Use A10 (24 GB) or A100.      |
| `Repository not found: sesame/csm-1b`    | HF_TOKEN missing or you haven't accepted the license at huggingface.co/sesame/csm-1b.           |
| Audio plays but mouth doesn't animate    | Browser blocked autoplay until first user gesture — already handled inside Vextorn's voice-room.|

---

## Cost ballpark (Modal A10G, scale-to-zero)

- Idle: $0
- Active: ~$1.10 / GPU-hour, ~0.5–1.5 s of GPU per sentence → roughly $0.0003–0.001 per sentence
- A typical 5-min tutor session ≈ 60 sentences ≈ $0.02–0.06
