from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "artifacts" / "meshy" / "househead-a-pose.png"
ENV_FILE = Path(os.environ.get("MESHY_ENV_FILE", r"C:\Users\nacho\Desktop\Meshy\.env"))
OUTPUT_DIR = ROOT / "public" / "models-v24" / "characters"
JOURNAL_PATH = ROOT / "artifacts" / "meshy" / "househead-character-v2.json"
API = "https://api.meshy.ai/openapi/v1"
TERMINAL = {"SUCCEEDED", "FAILED", "CANCELED", "CANCELLED", "EXPIRED"}


def load_key() -> str:
    if not ENV_FILE.exists():
        raise RuntimeError(f"Meshy env file missing: {ENV_FILE}")
    for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() == "MESHY_API_KEY":
            key = value.strip().strip('"').strip("'")
            if key:
                return key
    raise RuntimeError("MESHY_API_KEY is not set in the configured env file")


def load_journal() -> dict:
    if JOURNAL_PATH.exists():
        return json.loads(JOURNAL_PATH.read_text(encoding="utf-8"))
    return {"asset": "househead-character-v2", "reference": str(REFERENCE), "tasks": {}}


def save_journal(journal: dict) -> None:
    JOURNAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    JOURNAL_PATH.write_text(json.dumps(journal, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def request_json(key: str, method: str, path: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    last_error = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code not in {429, 500, 502, 503, 504}:
                raise RuntimeError(f"Meshy HTTP {exc.code}: {body[:500]}") from exc
            last_error = RuntimeError(f"Meshy transient HTTP {exc.code}: {body[:300]}")
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
        time.sleep(min(30, 2 ** attempt * 3))
    raise RuntimeError(f"Meshy request failed after retries: {last_error}")


def task_id(response: dict) -> str:
    value = response.get("result")
    if isinstance(value, str):
        return value
    if isinstance(value, dict) and isinstance(value.get("id"), str):
        return value["id"]
    if isinstance(response.get("id"), str):
        return response["id"]
    raise RuntimeError(f"No task id in Meshy response keys: {sorted(response)}")


def poll(key: str, path: str, journal: dict, stage: str, timeout_seconds: int = 1800) -> dict:
    started = time.monotonic()
    last_status = None
    while True:
        task = request_json(key, "GET", path)
        status = str(task.get("status") or task.get("result", {}).get("status") or "UNKNOWN").upper()
        journal["tasks"][stage]["status"] = status
        save_journal(journal)
        if status != last_status:
            print(f"{stage}: {status}", flush=True)
            last_status = status
        if status in TERMINAL:
            if status != "SUCCEEDED":
                error = task.get("task_error") or task.get("error") or task.get("message")
                raise RuntimeError(f"{stage} ended as {status}: {error}")
            return task
        if time.monotonic() - started > timeout_seconds:
            raise TimeoutError(f"Timed out polling {stage}; rerun this script to resume")
        time.sleep(10)


def nested_url(task: dict, *paths: tuple[str, ...]) -> str:
    for path in paths:
        value = task
        for key in path:
            if not isinstance(value, dict):
                value = None
                break
            value = value.get(key)
        if isinstance(value, str) and value.startswith("http"):
            return value
    raise RuntimeError(f"Expected download URL missing from task keys: {sorted(task)}")


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = destination.with_suffix(destination.suffix + ".part")
    with urllib.request.urlopen(url, timeout=180) as response, temp.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    if temp.stat().st_size < 1024:
        raise RuntimeError(f"Downloaded file is unexpectedly small: {temp}")
    temp.replace(destination)
    print(f"downloaded: {destination.name} ({destination.stat().st_size} bytes)", flush=True)


def ensure_task(key: str, journal: dict, stage: str, endpoint: str, payload: dict) -> str:
    existing = journal["tasks"].get(stage, {}).get("id")
    if existing:
        print(f"{stage}: resuming {existing}", flush=True)
        return existing
    created = request_json(key, "POST", endpoint, payload)
    identifier = task_id(created)
    journal["tasks"][stage] = {"id": identifier, "status": "CREATED"}
    save_journal(journal)
    print(f"{stage}: created {identifier}", flush=True)
    return identifier


def main() -> None:
    if not REFERENCE.exists():
        raise RuntimeError(f"Reference image missing: {REFERENCE}")
    key = load_key()
    journal = load_journal()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    mime = "image/png"
    image_uri = f"data:{mime};base64," + base64.b64encode(REFERENCE.read_bytes()).decode("ascii")
    image_id = ensure_task(
        key,
        journal,
        "image_to_3d",
        "/image-to-3d",
        {
            "image_url": image_uri,
            "enable_pbr": True,
            "should_remesh": True,
            "target_polycount": 20000,
            "should_texture": True,
            "pose_mode": "a-pose",
            "target_formats": ["glb"],
        },
    )
    image_task = poll(key, f"/image-to-3d/{image_id}", journal, "image_to_3d")
    image_url = nested_url(image_task, ("model_urls", "glb"), ("result", "model_urls", "glb"))
    source_path = OUTPUT_DIR / "househead-v2-source.glb"
    if not source_path.exists():
        download(image_url, source_path)

    rig_id = ensure_task(
        key,
        journal,
        "rigging",
        "/rigging",
        {"input_task_id": image_id, "height_meters": 1.35},
    )
    rig_task = poll(key, f"/rigging/{rig_id}", journal, "rigging")
    rig_url = nested_url(
        rig_task,
        ("rigged_character_glb_url",),
        ("result", "rigged_character_glb_url"),
    )
    rig_path = OUTPUT_DIR / "househead-v2-rigged.glb"
    if not rig_path.exists():
        download(rig_url, rig_path)

    idle_id = ensure_task(
        key,
        journal,
        "idle_animation",
        "/animations",
        {"rig_task_id": rig_id, "action_id": 0},
    )
    idle_task = poll(key, f"/animations/{idle_id}", journal, "idle_animation")
    idle_url = nested_url(
        idle_task,
        ("animation_glb_url",),
        ("result", "animation_glb_url"),
    )
    idle_path = OUTPUT_DIR / "househead-v2-idle.glb"
    if not idle_path.exists():
        download(idle_url, idle_path)

    journal["outputs"] = {
        "source": str(source_path.relative_to(ROOT)),
        "rigged": str(rig_path.relative_to(ROOT)),
        "idle": str(idle_path.relative_to(ROOT)),
    }
    save_journal(journal)
    print("pipeline: COMPLETE", flush=True)


if __name__ == "__main__":
    main()
