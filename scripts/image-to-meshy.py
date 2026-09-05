import argparse
import base64
import json
import mimetypes
import os
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = Path(os.environ.get("MESHY_ENV_FILE", Path.home() / "Desktop" / "Meshy" / ".env"))
API = "https://api.meshy.ai/openapi/v1/image-to-3d"


def api_key():
    name = "MESHY_API_KEY"
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError(f"{name} not found")


def request(method, url, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + api_key(),
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.load(response)


def write_journal(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--journal", required=True)
    parser.add_argument("--polycount", type=int, default=2600)
    parser.add_argument("--pose-mode", choices=["a-pose", "t-pose"])
    args = parser.parse_args()

    image = Path(args.image).resolve()
    output = Path(args.output).resolve()
    journal = Path(args.journal).resolve()
    state = json.loads(journal.read_text()) if journal.exists() else {}

    if not state.get("task_id"):
        mime = mimetypes.guess_type(image.name)[0] or "image/png"
        encoded = base64.b64encode(image.read_bytes()).decode("ascii")
        payload = {
            "image_url": f"data:{mime};base64,{encoded}",
            "model_type": "smart-topology",
            "ai_model": "meshy-t2",
            "target_polycount": args.polycount,
            "should_texture": True,
            "enable_pbr": False,
            "texture_resolution": "2k",
            "target_formats": ["glb"],
            "moderation": True,
        }
        if args.pose_mode:
            payload["pose_mode"] = args.pose_mode
        created = request("POST", API, payload)
        state = {"task_id": created["result"], "source": str(image), "polycount": args.polycount}
        write_journal(journal, state)

    while True:
        task = request("GET", f"{API}/{state['task_id']}")
        print(f"image-to-3d: {task.get('status')} {task.get('progress', 0)}%", flush=True)
        if task.get("status") == "SUCCEEDED":
            break
        if task.get("status") in {"FAILED", "CANCELED"}:
            state.update(status=task.get("status"), error=task.get("task_error"))
            write_journal(journal, state)
            raise RuntimeError(task.get("task_error") or task.get("status"))
        time.sleep(8)

    output.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(task["model_urls"]["glb"], output)
    state.update(status="downloaded", output=str(output), bytes=output.stat().st_size, credits=task.get("consumed_credits"))
    write_journal(journal, state)
    print(f"Downloaded: {output} ({output.stat().st_size} bytes)", flush=True)


if __name__ == "__main__":
    main()
