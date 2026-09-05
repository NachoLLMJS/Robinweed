import json
import os
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = Path(os.environ.get("MESHY_ENV_FILE", Path.home() / "Desktop" / "Meshy" / ".env"))
MODEL_JOURNAL = ROOT / "assets" / "meshy-tasks-v3" / "characters" / "milo-front.json"
STATE_PATH = ROOT / "assets" / "meshy-tasks-v3" / "characters" / "milo-animation.json"
OUT_DIR = ROOT / "public" / "models-v3" / "characters"
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


def save(state):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


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
    image_state = json.loads(MODEL_JOURNAL.read_text(encoding="utf-8"))
    if image_state.get("status") != "downloaded":
        raise RuntimeError("Milo Image-to-3D task is not complete")
    state = json.loads(STATE_PATH.read_text(encoding="utf-8")) if STATE_PATH.exists() else {}

    if not state.get("rig_task_id"):
        created = request("POST", RIG_API, {
            "input_task_id": image_state["task_id"],
            "height_meters": 1.82,
        })
        state["rig_task_id"] = created["result"]
        save(state)
    rig = wait(RIG_API, state["rig_task_id"], "rigging")
    rig_url = rig.get("rigged_character_glb_url") or rig.get("result", {}).get("rigged_character_glb_url")
    if rig_url:
        download(rig_url, OUT_DIR / "milo-rigged.glb")

    actions = {"idle": (0, "idle_task_id"), "talk": (313, "talk_313_task_id")}
    for name, (action_id, key) in actions.items():
        if not state.get(key):
            created = request("POST", ANIMATION_API, {
                "rig_task_id": state["rig_task_id"],
                "action_id": action_id,
            })
            state[key] = created["result"]
            save(state)
        task = wait(ANIMATION_API, state[key], f"animation-{name}")
        result = task.get("result", {})
        url = task.get("animation_glb_url") or result.get("animation_glb_url")
        if not url:
            raise RuntimeError(f"Animation {name} completed without animation_glb_url")
        download(url, OUT_DIR / f"milo-{name}.glb")

    state["status"] = "downloaded"
    save(state)


if __name__ == "__main__":
    main()
