import argparse
import json
import os
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = Path(os.environ.get("MESHY_ENV_FILE", Path.home() / "Desktop" / "Meshy" / ".env"))
RIG_API = "https://api.meshy.ai/openapi/v1/rigging"
ANIMATION_API = "https://api.meshy.ai/openapi/v1/animations"


def api_key():
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("MESHY_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("MESHY_API_KEY not found")


def request(method, url, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + api_key(),
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.load(response)


def save(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def wait(api, task_id, label):
    while True:
        task = request("GET", f"{api}/{task_id}")
        print(f"{label}: {task.get('status')} {task.get('progress', 0)}%", flush=True)
        if task.get("status") == "SUCCEEDED":
            return task
        if task.get("status") in {"FAILED", "CANCELED"}:
            raise RuntimeError(task.get("task_error") or task.get("status"))
        time.sleep(8)


def download(url, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, path)
    print(f"Downloaded {path} ({path.stat().st_size} bytes)", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-journal", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--height", type=float, required=True)
    parser.add_argument("--action-id", type=int, required=True)
    args = parser.parse_args()

    model_state = json.loads(Path(args.model_journal).read_text(encoding="utf-8"))
    if model_state.get("status") != "downloaded":
        raise RuntimeError("Image-to-3D task is not complete")
    state_path = Path(args.state)
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}

    if not state.get("rig_task_id"):
        created = request("POST", RIG_API, {
            "input_task_id": model_state["task_id"],
            "height_meters": args.height,
        })
        state["rig_task_id"] = created["result"]
        save(state_path, state)
    wait(RIG_API, state["rig_task_id"], "rigging")

    if not state.get("animation_task_id"):
        created = request("POST", ANIMATION_API, {
            "rig_task_id": state["rig_task_id"],
            "action_id": args.action_id,
        })
        state["animation_task_id"] = created["result"]
        state["action_id"] = args.action_id
        save(state_path, state)
    animation = wait(ANIMATION_API, state["animation_task_id"], "animation")
    result = animation.get("result", {})
    url = animation.get("animation_glb_url") or result.get("animation_glb_url")
    if not url:
        raise RuntimeError("Animation completed without animation_glb_url")
    output = Path(args.output)
    download(url, output)
    state.update(status="downloaded", output=str(output), bytes=output.stat().st_size)
    save(state_path, state)


if __name__ == "__main__":
    main()
