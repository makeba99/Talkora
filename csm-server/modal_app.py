"""
Modal deployment wrapper for the Sesame CSM inference server.

One-time setup:
    pip install modal
    modal token new                              # opens browser, sign in / sign up
    modal secret create hf-token HF_TOKEN=hf_xxx # paste the HF token you created

Deploy:
    modal deploy modal_app.py

You'll get back a URL like:
    https://<your-username>--vextorn-csm-fastapi-app.modal.run

Paste that URL into Railway as SESAME_CSM_URL and restart Vextorn — done.

Notes:
- container_idle_timeout=300 means the GPU spins down after 5 min of no traffic
  → you only pay while the tutor is actually talking.
- gpu="A10G" is the sweet spot for CSM-1B (24 GB VRAM, ~$1.10/hr while warm).
  Switch to "T4" for cheaper but slower, or "A100" for fastest first-audio.
"""

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install_from_requirements("requirements.txt")
    .add_local_file("server.py", remote_path="/root/server.py")
)

app = modal.App(
    "vextorn-csm",
    image=image,
    secrets=[
        modal.Secret.from_name("hf-token"),
        # Optional shared bearer between Vextorn and CSM. Create with:
        #   modal secret create vextorn-csm-token SESAME_CSM_TOKEN=$(openssl rand -hex 24)
        # Then set the same value as SESAME_CSM_TOKEN on Railway.
        # Comment this line out if you don't want auth.
        modal.Secret.from_name("vextorn-csm-token", required_keys=["SESAME_CSM_TOKEN"]),
    ],
)


@app.function(
    gpu="A10G",
    timeout=600,
    container_idle_timeout=300,
    memory=16384,
    allow_concurrent_inputs=4,
)
@modal.asgi_app()
def fastapi_app():
    import sys
    sys.path.insert(0, "/root")
    from server import app as fastapi
    return fastapi
