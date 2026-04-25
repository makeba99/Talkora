"""Modal deployment wrapper for the Sesame CSM inference server.

The CSM repo (https://github.com/SesameAILabs/csm) is NOT a pip-installable
package — `generator.py` and `models.py` sit at the repo root. So instead of
`pip install git+...`, we git-clone the repo into the image and add /csm to
sys.path so `from generator import ...` works at runtime.
"""

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install_from_requirements("requirements.txt")
    # Clone CSM source (loose modules at repo root — not pip installable).
    .run_commands(
        "git clone --depth 1 https://github.com/SesameAILabs/csm.git /csm",
    )
    .add_local_file("server.py", remote_path="/root/server.py")
)

app = modal.App(
    "vextorn-csm",
    image=image,
    secrets=[
        modal.Secret.from_name("hf-token"),
        modal.Secret.from_name("vextorn-csm-token", required_keys=["SESAME_CSM_TOKEN"]),
    ],
)


@app.function(
    gpu="A10G",
    timeout=600,
    scaledown_window=300,
    memory=16384,
)
@modal.concurrent(max_inputs=4)
@modal.asgi_app()
def fastapi_app():
    import sys
    # /csm has the CSM source (generator.py, models.py, watermarking.py).
    # /root has our FastAPI server.py.
    sys.path.insert(0, "/csm")
    sys.path.insert(0, "/root")
    from server import app as fastapi
    return fastapi
