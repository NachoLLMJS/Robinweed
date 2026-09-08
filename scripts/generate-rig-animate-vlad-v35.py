from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "artifacts" / "meshy" / "vlad-v35" / "reference" / "vlad-tenev-tpose.png"
JOURNAL = ROOT / "artifacts" / "meshy" / "vlad-v35" / "journals" / "pipeline.json"
OUTPUT = ROOT / "public" / "models-v35" / "characters"
ENV_FILE = Path(os.environ.get("MESHY_ENV_FILE", r"C:\Users\nacho\Desktop\Meshy\.env"))
BASE_URL = "https://api.meshy.ai/openapi/v1"
TERMINAL = {"SUCCEEDED", "FAILED", "CANCELED", "EXPIRED"}
ACTIONS = {"idle": 0, "talk": 313}


def load_key() -> str:
    for raw in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() in {"MESHY_API_KEY", "MESHY_KEY", "API_KEY"}:
            return value.strip().strip('"').strip("'")
    raise RuntimeError("Meshy API key not found")


def request_json(key: str, method: str, endpoint: str, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        BASE_URL + endpoint,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode(errors="replace")
        raise RuntimeError(f"Meshy HTTP {error.code}: {body[:500]}") from error


def response_id(value) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("result", "id", "task_id"):
            candidate = value.get(key)
            if isinstance(candidate, str):
                return candidate
            if isinstance(candidate, dict):
                nested = candidate.get("id") or candidate.get("task_id")
                if nested:
                    return nested
    raise RuntimeError("Meshy response did not contain a task ID")


def load_journal():
    if JOURNAL.exists():
        return json.loads(JOURNAL.read_text(encoding="utf-8"))
    return {"reference": str(REFERENCE.relative_to(ROOT)), "tasks": {}}


def save_journal(state):
    JOURNAL.parent.mkdir(parents=True, exist_ok=True)
    JOURNAL.write_text(json.dumps(state, indent=2), encoding="utf-8")


def ensure_task(key, state, stage, endpoint, payload):
    existing = state["tasks"].get(stage)
    if existing:
        print(f"{stage}: resume {existing['id']}", flush=True)
        return existing["id"]
    task_id = response_id(request_json(key, "POST", endpoint, payload))
    state["tasks"][stage] = {"id": task_id, "status": "CREATED"}
    save_journal(state)
    print(f"{stage}: created {task_id}", flush=True)
    return task_id


def wait_task(key, state, stage, endpoint, task_id, timeout=2400):
    started = time.time()
    previous = None
    while time.time() - started < timeout:
        result = request_json(key, "GET", f"{endpoint}/{task_id}")
        status = str(result.get("status", "")).upper()
        if status != previous:
            print(f"{stage}: {status}", flush=True)
            previous = status
        state["tasks"][stage]["status"] = status
        save_journal(state)
        if status in TERMINAL:
            if status != "SUCCEEDED":
                raise RuntimeError(f"{stage} failed: {status} {result.get('task_error')}")
            return result
        time.sleep(8)
    raise TimeoutError(f"{stage} timed out")


def find_url(result, *keys):
    containers = [result.get("model_urls", {}), result, result.get("result", {})]
    for container in containers:
        if not isinstance(container, dict):
            continue
        for key in keys:
            value = container.get(key)
            if isinstance(value, str) and value.startswith("http"):
                return value
    raise RuntimeError(f"No output URL found for {keys}")


def download(url: str, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=240) as response:
        path.write_bytes(response.read())
    print(f"downloaded: {path.name} ({path.stat().st_size} bytes)", flush=True)


def main():
    if not REFERENCE.exists():
        raise FileNotFoundError(REFERENCE)
    key = load_key()
    state = load_journal()
    OUTPUT.mkdir(parents=True, exist_ok=True)

    image_uri = "data:image/png;base64," + base64.b64encode(REFERENCE.read_bytes()).decode("ascii")
    image_id = ensure_task(key, state, "image_to_3d", "/image-to-3d", {
        "image_url": image_uri,
        "model_type": "smart-topology",
        "ai_model": "meshy-t2",
        "target_polycount": 15000,
        "should_texture": True,
        "enable_pbr": False,
        "texture_resolution": "2k",
        "target_formats": ["glb"],
        "pose_mode": "t-pose",
        "moderation": True,
    })
    image_result = wait_task(key, state, "image_to_3d", "/image-to-3d", image_id)
    download(find_url(image_result, "glb"), OUTPUT / "vlad-tenev-source.glb")

    rig_id = ensure_task(key, state, "rigging", "/rigging", {
        "input_task_id": image_id,
        "height_meters": 1.82,
    })
    rig_result = wait_task(key, state, "rigging", "/rigging", rig_id)
    download(find_url(rig_result, "rigged_character_glb_url", "glb"), OUTPUT / "vlad-tenev-rigged.glb")

    for name, action_id in ACTIONS.items():
        stage = f"animation_{name}"
        task_id = ensure_task(key, state, stage, "/animations", {
            "rig_task_id": rig_id,
            "action_id": action_id,
        })
        result = wait_task(key, state, stage, "/animations", task_id)
        download(find_url(result, "animation_glb_url", "glb"), OUTPUT / f"vlad-tenev-{name}.glb")

    state["complete"] = True
    save_journal(state)
    print("pipeline: COMPLETE", flush=True)


if __name__ == "__main__":
    main()
