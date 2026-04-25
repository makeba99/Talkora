"""
Sesame CSM inference server — reference FastAPI implementation that Vextorn's
AI Tutor talks to over HTTP.

This file is NOT run inside the Vextorn project (Replit has no GPU). It is
meant to be deployed separately on a GPU-backed host:

    - Modal (`modal deploy server.py`)
    - RunPod / Lambda Labs / Vast.ai (Docker)
    - Hugging Face Inference Endpoints (custom handler)
    - Your own GPU box

Once running, expose the URL to Vextorn via the SESAME_CSM_URL secret.

Endpoints:
    GET  /healthz   — liveness probe (no auth needed)
    POST /v1/tts    — generate audio from text
                      body: { text, speaker, voice, speed, language,
                              max_audio_length_ms, format }
                      auth: Authorization: Bearer <SESAME_CSM_TOKEN> (optional)
                      returns: audio/wav bytes

Hardware: CSM-1B needs ~4 GB VRAM. Tested on T4 (16 GB), A10 (24 GB),
A100 (40/80 GB). CPU works but is far too slow for interactive use.
"""

from __future__ import annotations

import io
import os
import time
import wave
from typing import Optional

import torch
import torchaudio
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field

# CSM is installed via:  pip install git+https://github.com/SesameAILabs/csm.git
# (and `huggingface-cli login` for the gated weights)
from generator import Segment, load_csm_1b  # type: ignore


# ── Config ──────────────────────────────────────────────────────────────────
AUTH_TOKEN = os.environ.get("SESAME_CSM_TOKEN", "").strip()
DEVICE = (
    "cuda" if torch.cuda.is_available()
    else ("mps" if torch.backends.mps.is_available() else "cpu")
)
MAX_TEXT_CHARS = int(os.environ.get("CSM_MAX_TEXT_CHARS", "600"))
MAX_AUDIO_MS_HARD_CAP = int(os.environ.get("CSM_MAX_AUDIO_MS", "10000"))


# ── Model lifecycle ─────────────────────────────────────────────────────────
print(f"[csm-server] loading sesame/csm-1b on device={DEVICE} ...")
_t0 = time.time()
GENERATOR = load_csm_1b(device=DEVICE)
print(f"[csm-server] model ready in {time.time() - _t0:.1f}s")


# ── API ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Sesame CSM TTS", version="1.0")


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1)
    speaker: int = Field(0, ge=0, le=63)
    voice: Optional[str] = "Female"
    speed: float = Field(1.0, ge=0.5, le=2.0)
    language: Optional[str] = "en"
    max_audio_length_ms: int = Field(10000, ge=500, le=15000)
    format: Optional[str] = "wav"


def _check_auth(request: Request) -> None:
    if not AUTH_TOKEN:
        return
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    if header[7:].strip() != AUTH_TOKEN:
        raise HTTPException(401, "invalid token")


@app.get("/healthz")
def healthz() -> dict:
    return {
        "ok": True,
        "device": DEVICE,
        "model": "sesame/csm-1b",
        "auth_required": bool(AUTH_TOKEN),
    }


@app.post("/v1/tts")
def tts(req: TtsRequest, request: Request) -> Response:
    _check_auth(request)

    text = req.text.strip()
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS]

    max_ms = min(req.max_audio_length_ms, MAX_AUDIO_MS_HARD_CAP)

    t0 = time.time()
    try:
        # CSM expects: text, speaker int, optional context segments.
        # Empty context yields a clean unconditioned generation, which is what
        # we want for short tutor replies.
        audio = GENERATOR.generate(
            text=text,
            speaker=req.speaker,
            context=[],
            max_audio_length_ms=max_ms,
        )
    except Exception as exc:  # pragma: no cover
        raise HTTPException(500, f"generation failed: {exc}") from exc

    sr = GENERATOR.sample_rate

    # CSM returns a 1-D float tensor on the model device. Resample / speed
    # adjustments happen client-side via Web Audio playbackRate, so we just
    # ship the raw waveform. Optional crude server-side speed could go here.

    # Encode WAV (16-bit PCM, mono)
    audio_cpu = audio.detach().to("cpu")
    if audio_cpu.dim() == 1:
        audio_cpu = audio_cpu.unsqueeze(0)  # (1, T)

    buf = io.BytesIO()
    torchaudio.save(buf, audio_cpu, sample_rate=sr, format="wav", encoding="PCM_S", bits_per_sample=16)
    wav_bytes = buf.getvalue()

    elapsed_ms = int((time.time() - t0) * 1000)
    print(f"[csm-server] tts ok speaker={req.speaker} chars={len(text)} "
          f"audio_ms={int(audio_cpu.shape[-1] / sr * 1000)} latency_ms={elapsed_ms}")

    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "X-CSM-Latency-Ms": str(elapsed_ms),
            "X-CSM-Sample-Rate": str(sr),
            "X-CSM-Speaker": str(req.speaker),
        },
    )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
