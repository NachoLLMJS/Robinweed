from __future__ import annotations

import base64
import json
import os
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts" / "meshy" / "fox-walker" / "fox-meshy-input.glb"
ENV_FILE = Path(os.environ.get("MESHY_ENV_FILE", r"C:\Users\nacho\Desktop\Meshy\.env"))
OUTPUT_DIR = ROOT / "public" / "models-v30" / "characters"
JOURNAL_PATH = ROOT / "artifacts" / "meshy" / "fox-walker.json"
API = "https://api.meshy.ai/openapi/v1"
TERMINAL = {"SUCCEEDED", "FAILED", "CANCELED", "CANCELLED", "EXPIRED"}
WALK_ACTION_ID = 30  # Casual_Walk, verified against Meshy's official library.


def load_key() -> str:
    if not ENV_FILE.exists(): raise RuntimeError(f"Meshy env file missing: {ENV_FILE}")
    for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            if name.strip() == "MESHY_API_KEY" and value.strip().strip('"').strip("'"):
                return value.strip().strip('"').strip("'")
    raise RuntimeError("MESHY_API_KEY is not set in the configured env file")


def load_journal() -> dict:
    if JOURNAL_PATH.exists(): return json.loads(JOURNAL_PATH.read_text(encoding="utf-8"))
    return {"asset": "fox-walker", "source": str(SOURCE), "tasks": {}}


def save(journal: dict) -> None:
    JOURNAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    JOURNAL_PATH.write_text(json.dumps(journal, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def request_json(key: str, method: str, path: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json",
    })
    last = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code not in {429, 500, 502, 503, 504}:
                raise RuntimeError(f"Meshy HTTP {exc.code}: {body[:500]}") from exc
            last = RuntimeError(f"Meshy transient HTTP {exc.code}: {body[:300]}")
        except (urllib.error.URLError, TimeoutError) as exc: last = exc
        time.sleep(min(30, 2 ** attempt * 3))
    raise RuntimeError(f"Meshy request failed after retries: {last}")


def response_id(response: dict) -> str:
    value = response.get("result")
    if isinstance(value, str): return value
    if isinstance(value, dict) and isinstance(value.get("id"), str): return value["id"]
    if isinstance(response.get("id"), str): return response["id"]
    raise RuntimeError(f"No task id in Meshy response keys: {sorted(response)}")


def ensure_task(key: str, journal: dict, stage: str, endpoint: str, payload: dict) -> str:
    existing = journal["tasks"].get(stage, {}).get("id")
    if existing:
        print(f"{stage}: resuming {existing}", flush=True); return existing
    identifier = response_id(request_json(key, "POST", endpoint, payload))
    journal["tasks"][stage] = {"id": identifier, "status": "CREATED"}; save(journal)
    print(f"{stage}: created {identifier}", flush=True); return identifier


def poll(key: str, endpoint: str, journal: dict, stage: str, timeout_seconds=1800) -> dict:
    started = time.monotonic(); last_status = None
    while True:
        task = request_json(key, "GET", endpoint)
        nested = task.get("result") if isinstance(task.get("result"), dict) else {}
        status = str(task.get("status") or nested.get("status") or "UNKNOWN").upper()
        journal["tasks"][stage]["status"] = status; save(journal)
        if status != last_status: print(f"{stage}: {status}", flush=True); last_status = status
        if status in TERMINAL:
            if status != "SUCCEEDED":
                error = task.get("task_error") or task.get("error") or task.get("message")
                raise RuntimeError(f"{stage} ended as {status}: {error}")
            return task
        if time.monotonic() - started > timeout_seconds: raise TimeoutError(f"Timed out polling {stage}; rerun to resume")
        time.sleep(10)


def get_url(task: dict, *paths: tuple[str, ...]) -> str:
    for path in paths:
        value = task
        for key in path:
            if not isinstance(value, dict): value = None; break
            value = value.get(key)
        if isinstance(value, str) and value.startswith("http"): return value
    raise RuntimeError(f"Expected download URL missing from task keys: {sorted(task)}")


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True); temp = destination.with_suffix(destination.suffix + ".part")
    with urllib.request.urlopen(url, timeout=180) as response, temp.open("wb") as output:
        while chunk := response.read(1024 * 1024): output.write(chunk)
    if temp.stat().st_size < 1024: raise RuntimeError(f"Downloaded file is unexpectedly small: {temp}")
    temp.replace(destination); print(f"downloaded: {destination.name} ({destination.stat().st_size} bytes)", flush=True)


def main() -> None:
    if not SOURCE.exists(): raise RuntimeError(f"Source GLB missing: {SOURCE}")
    key = load_key(); journal = load_journal(); OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source_copy = OUTPUT_DIR / "fox-source.glb"
    if not source_copy.exists(): shutil.copy2(SOURCE, source_copy)
    model_uri = "data:model/gltf-binary;base64," + base64.b64encode(SOURCE.read_bytes()).decode("ascii")
    rig_id = ensure_task(key, journal, "rigging", "/rigging", {"model_url": model_uri, "height_meters": 1.25})
    rig_task = poll(key, f"/rigging/{rig_id}", journal, "rigging")
    rigged = OUTPUT_DIR / "fox-rigged.glb"
    if not rigged.exists(): download(get_url(rig_task, ("rigged_character_glb_url",), ("result", "rigged_character_glb_url")), rigged)
    walk_id = ensure_task(key, journal, "walk_animation", "/animations", {"rig_task_id": rig_id, "action_id": WALK_ACTION_ID})
    walk_task = poll(key, f"/animations/{walk_id}", journal, "walk_animation")
    walk = OUTPUT_DIR / "fox-walk.glb"
    if not walk.exists(): download(get_url(walk_task, ("animation_glb_url",), ("result", "animation_glb_url")), walk)
    journal["outputs"] = {"source": str(source_copy.relative_to(ROOT)), "rigged": str(rigged.relative_to(ROOT)), "walk": str(walk.relative_to(ROOT))}
    journal["action"] = {"id": WALK_ACTION_ID, "name": "Casual_Walk"}; save(journal)
    print("pipeline: COMPLETE", flush=True)


if __name__ == "__main__": main()
