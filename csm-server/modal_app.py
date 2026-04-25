"""Modal deployment wrapper for the Sesame CSM inference server."""

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
    sys.path.insert(0, "/root")
    from server import app as fastapi
    return fastapi