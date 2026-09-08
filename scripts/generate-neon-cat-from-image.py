from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = Path(r"C:\Users\nacho\Desktop\a20fbab2-222a-40ae-9bb0-3749257c586e.png")
ENV_FILE = Path(os.environ.get("MESHY_ENV_FILE", r"C:\Users\nacho\Desktop\Meshy\.env"))
OUTPUT_DIR = ROOT / "public" / "models-v31" / "characters"
JOURNAL_PATH = ROOT / "artifacts" / "meshy" / "neon-cat-walker.json"
BASE_URL = "https://api.meshy.ai/openapi/v1"
ACTION_ID = 30
TERMINAL = {"SUCCEEDED", "FAILED", "CANCELED", "EXPIRED"}


def load_key():
    for raw in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        name, value = line.split("=", 1)
        if name.strip() in {"MESHY_API_KEY", "MESHY_KEY", "API_KEY"}:
            return value.strip().strip('"').strip("'")
    raise RuntimeError("Meshy API key not found")


def request_json(key, method, endpoint, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(BASE_URL + endpoint, data=data, method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"Meshy HTTP {exc.code}: {body[:500]}") from exc


def response_id(value):
    if isinstance(value, str): return value
    if isinstance(value, dict):
        for key in ("result", "id", "task_id"):
            candidate = value.get(key)
            if isinstance(candidate, str): return candidate
            if isinstance(candidate, dict):
                nested = candidate.get("id") or candidate.get("task_id")
                if nested: return nested
    raise RuntimeError(f"No task ID in response: {value}")


def load_journal():
    if not JOURNAL_PATH.exists(): return {"reference": str(REFERENCE), "action_id": ACTION_ID, "tasks": {}}
    return json.loads(JOURNAL_PATH.read_text(encoding="utf-8"))


def save_journal(journal):
    JOURNAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    JOURNAL_PATH.write_text(json.dumps(journal, indent=2), encoding="utf-8")


def ensure_task(key, journal, stage, endpoint, payload):
    if stage in journal["tasks"]: return journal["tasks"][stage]["id"]
    task_id = response_id(request_json(key, "POST", endpoint, payload))
    journal["tasks"][stage] = {"id": task_id}
    save_journal(journal)
    print(f"{stage}: created {task_id}", flush=True)
    return task_id


def wait_task(key, journal, stage, endpoint, task_id, timeout=1800):
    started = time.time(); last = None
    while time.time() - started < timeout:
        result = request_json(key, "GET", f"{endpoint}/{task_id}")
        status = str(result.get("status", "")).upper()
        if status != last:
            print(f"{stage}: {status}", flush=True); last = status
        journal["tasks"][stage]["status"] = status
        journal["tasks"][stage]["result"] = result
        save_journal(journal)
        if status in TERMINAL:
            if status != "SUCCEEDED": raise RuntimeError(f"{stage} failed: {status} {result.get('task_error')} ")
            return result
        time.sleep(8)
    raise TimeoutError(f"{stage} timed out")


def download(url, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=180) as response: output.write_bytes(response.read())
    print(f"downloaded: {output.name} ({output.stat().st_size} bytes)", flush=True)


def find_url(result, *keys):
    containers = [result.get("model_urls", {}), result, result.get("result", {})]
    for container in containers:
        if not isinstance(container, dict): continue
        for key in keys:
            value = container.get(key)
            if isinstance(value, str) and value.startswith("http"): return value
    raise RuntimeError(f"No model URL for {keys}")


def main():
    if not REFERENCE.exists(): raise FileNotFoundError(REFERENCE)
    key = load_key(); journal = load_journal(); OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    image_uri = "data:image/png;base64," + base64.b64encode(REFERENCE.read_bytes()).decode()
    image_id = ensure_task(key, journal, "image_to_3d", "/image-to-3d", {
        "image_url": image_uri,
        "enable_pbr": False,
        "should_texture": True,
        "should_remesh": True,
        "target_polycount": 18000,
        "topology": "triangle",
    })
    image_result = wait_task(key, journal, "image_to_3d", "/image-to-3d", image_id)
    download(find_url(image_result, "glb"), OUTPUT_DIR / "neon-cat-source.glb")
    rig_id = ensure_task(key, journal, "rigging", "/rigging", {
        "input_task_id": image_id,
        "height_meters": 1.8,
        "pose_mode": "a-pose",
    })
    rig_result = wait_task(key, journal, "rigging", "/rigging", rig_id)
    download(find_url(rig_result, "rigged_character_glb_url", "glb"), OUTPUT_DIR / "neon-cat-rigged.glb")
    anim_id = ensure_task(key, journal, "walk_animation", "/animations", {
        "rig_task_id": rig_id,
        "action_id": ACTION_ID,
    })
    anim_result = wait_task(key, journal, "walk_animation", "/animations", anim_id)
    download(find_url(anim_result, "animation_glb_url", "glb"), OUTPUT_DIR / "neon-cat-walk.glb")
    journal["complete"] = True; save_journal(journal)
    print("pipeline: COMPLETE", flush=True)


if __name__ == "__main__": main()
