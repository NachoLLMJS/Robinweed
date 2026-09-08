from __future__ import annotations

import base64
import json
import os
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = Path(os.environ.get("MESHY_ENV_FILE", r"C:\Users\nacho\Desktop\Meshy\.env"))
BASE = ROOT / "artifacts" / "meshy" / "stock-seed-packs"
REFERENCE_DIR = BASE / "references-v2"
JOURNAL_DIR = BASE / "journals-v2"
OUTPUT_DIR = ROOT / "public" / "models-v26" / "items" / "stock-seed-packs"
API = "https://api.meshy.ai/openapi/v1/image-to-3d"
TERMINAL = {"SUCCEEDED", "FAILED", "CANCELED", "CANCELLED", "EXPIRED"}
ASSETS = ("msft", "tsla", "nvda", "mstr", "aapl", "qqq", "googl")
print_lock = threading.Lock()


def log(message: str) -> None:
    with print_lock:
        print(message, flush=True)


def load_key() -> str:
    if not ENV_FILE.exists():
        raise RuntimeError(f"Meshy env file missing: {ENV_FILE}")
    for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() == "MESHY_API_KEY" and value.strip():
            return value.strip().strip('"').strip("'")
    raise RuntimeError("MESHY_API_KEY is not set")


def request_json(key: str, method: str, url: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    last_error = None
    for attempt in range(5):
        request = urllib.request.Request(url, data=data, method=method, headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        })
        try:
            with urllib.request.urlopen(request, timeout=150) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code not in {429, 500, 502, 503, 504}:
                raise RuntimeError(f"Meshy HTTP {exc.code}: {body[:500]}") from exc
            last_error = f"HTTP {exc.code}: {body[:180]}"
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = str(exc)
        time.sleep(min(30, 3 * (2 ** attempt)))
    raise RuntimeError(f"Meshy request failed after retries: {last_error}")


def read_journal(path: Path, slug: str, reference: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"asset": slug, "reference": str(reference.relative_to(ROOT)), "task_id": None, "status": "NEW"}


def save_journal(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def task_id(response: dict) -> str:
    value = response.get("result")
    if isinstance(value, str):
        return value
    if isinstance(value, dict) and isinstance(value.get("id"), str):
        return value["id"]
    raise RuntimeError(f"No task id in Meshy response keys: {sorted(response)}")


def model_url(task: dict) -> str:
    for value in (task.get("model_urls", {}).get("glb"), task.get("result", {}).get("model_urls", {}).get("glb")):
        if isinstance(value, str) and value.startswith("http"):
            return value
    raise RuntimeError(f"GLB URL missing from task keys: {sorted(task)}")


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    part = destination.with_suffix(".glb.part")
    with urllib.request.urlopen(url, timeout=240) as response, part.open("wb") as out:
        while chunk := response.read(1024 * 1024):
            out.write(chunk)
    if part.stat().st_size < 1024:
        raise RuntimeError(f"Downloaded file too small: {part}")
    part.replace(destination)


def generate_one(key: str, slug: str) -> dict:
    reference = REFERENCE_DIR / f"{slug}-seed-pack.png"
    journal_path = JOURNAL_DIR / f"{slug}.json"
    output = OUTPUT_DIR / f"{slug}-seed-pack.glb"
    if not reference.exists():
        raise RuntimeError(f"Reference missing: {reference}")
    state = read_journal(journal_path, slug, reference)

    if not state.get("task_id"):
        encoded = base64.b64encode(reference.read_bytes()).decode("ascii")
        created = request_json(key, "POST", API, {
            "image_url": "data:image/png;base64," + encoded,
            "enable_pbr": False,
            "should_remesh": True,
            "target_polycount": 5000,
            "should_texture": True,
            "texture_resolution": "2k",
            "target_formats": ["glb"],
        })
        state["task_id"] = task_id(created)
        state["status"] = "CREATED"
        save_journal(journal_path, state)
        log(f"{slug}: created {state['task_id']}")
    else:
        log(f"{slug}: resuming {state['task_id']}")

    last_status = None
    while True:
        task = request_json(key, "GET", f"{API}/{state['task_id']}")
        status = str(task.get("status") or task.get("result", {}).get("status") or "UNKNOWN").upper()
        state["status"] = status
        state["progress"] = task.get("progress", state.get("progress", 0))
        save_journal(journal_path, state)
        if status != last_status:
            log(f"{slug}: {status} {state['progress']}%")
            last_status = status
        if status in TERMINAL:
            if status != "SUCCEEDED":
                raise RuntimeError(f"{slug} ended {status}: {task.get('task_error') or task.get('error')}")
            break
        time.sleep(10)

    if not output.exists():
        download(model_url(task), output)
    state.update(status="DOWNLOADED", output=str(output.relative_to(ROOT)), bytes=output.stat().st_size, credits=task.get("consumed_credits"))
    save_journal(journal_path, state)
    log(f"{slug}: downloaded {output.name} ({output.stat().st_size} bytes)")
    return {"slug": slug, "output": str(output), "bytes": output.stat().st_size}


def main() -> None:
    key = load_key()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    failures = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(generate_one, key, slug): slug for slug in ASSETS}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                results.append(future.result())
            except Exception as exc:
                failures.append({"slug": slug, "error": str(exc)})
                log(f"{slug}: FAILED {exc}")
    summary = {"generated": sorted(results, key=lambda x: ASSETS.index(x["slug"])), "failures": failures}
    (BASE / "generation-summary-v2.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    if failures:
        raise RuntimeError(f"{len(failures)} asset(s) failed; rerun to resume")
    log(f"batch: COMPLETE ({len(results)} assets)")


if __name__ == "__main__":
    main()
