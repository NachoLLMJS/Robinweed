from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "artifacts" / "meshy" / "mature-bud" / "meshy-bud-reference.png"
ENV_FILE = Path(os.environ.get("MESHY_ENV_FILE", r"C:\Users\nacho\Desktop\Meshy\.env"))
OUTPUT = ROOT / "public" / "models-v32" / "plants" / "meshy-cannabis-bud.glb"
JOURNAL_PATH = ROOT / "artifacts" / "meshy" / "mature-bud.json"
BASE_URL = "https://api.meshy.ai/openapi/v1"
TERMINAL = {"SUCCEEDED", "FAILED", "CANCELED", "EXPIRED"}


def load_key():
    for raw in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() in {"MESHY_API_KEY", "MESHY_KEY", "API_KEY"}:
            return value.strip().strip('"').strip("'")
    raise RuntimeError("Meshy API key not found")


def request_json(key, method, endpoint, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        BASE_URL + endpoint,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"Meshy HTTP {exc.code}: {body[:500]}") from exc


def response_id(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        candidate = value.get("result") or value.get("id") or value.get("task_id")
        if isinstance(candidate, str):
            return candidate
        if isinstance(candidate, dict):
            nested = candidate.get("id") or candidate.get("task_id")
            if nested:
                return nested
    raise RuntimeError("Meshy response did not contain a task ID")


def load_journal():
    if JOURNAL_PATH.exists():
        return json.loads(JOURNAL_PATH.read_text(encoding="utf-8"))
    return {"reference": str(REFERENCE), "tasks": {}}


def save_journal(journal):
    JOURNAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    JOURNAL_PATH.write_text(json.dumps(journal, indent=2), encoding="utf-8")


def find_glb(result):
    for container in (result.get("model_urls", {}), result, result.get("result", {})):
        if not isinstance(container, dict):
            continue
        for key in ("glb", "model_glb_url", "output_glb_url"):
            value = container.get(key)
            if isinstance(value, str) and value.startswith("http"):
                return value
    raise RuntimeError("Meshy task completed without a GLB URL")


def main():
    if not REFERENCE.exists():
        raise FileNotFoundError(REFERENCE)
    key = load_key()
    journal = load_journal()
    task = journal["tasks"].get("image_to_3d")
    if task:
        task_id = task["id"]
        print(f"image_to_3d: resuming {task_id}", flush=True)
    else:
        image_uri = "data:image/png;base64," + base64.b64encode(REFERENCE.read_bytes()).decode()
        task_id = response_id(request_json(key, "POST", "/image-to-3d", {
            "image_url": image_uri,
            "enable_pbr": False,
            "should_texture": True,
            "should_remesh": True,
            "target_polycount": 10000,
            "topology": "triangle",
        }))
        journal["tasks"]["image_to_3d"] = {"id": task_id}
        save_journal(journal)
        print(f"image_to_3d: created {task_id}", flush=True)

    last_status = None
    while True:
        result = request_json(key, "GET", f"/image-to-3d/{task_id}")
        status = str(result.get("status", "")).upper()
        if status != last_status:
            print(f"image_to_3d: {status}", flush=True)
            last_status = status
        journal["tasks"]["image_to_3d"].update({"status": status, "result": result})
        save_journal(journal)
        if status in TERMINAL:
            if status != "SUCCEEDED":
                raise RuntimeError(f"Meshy generation failed: {status}")
            break
        time.sleep(8)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(find_glb(result), timeout=180) as response:
        OUTPUT.write_bytes(response.read())
    journal["complete"] = True
    save_journal(journal)
    print(f"downloaded: {OUTPUT} ({OUTPUT.stat().st_size} bytes)", flush=True)


if __name__ == "__main__":
    main()
