import base64
import json
import mimetypes
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = Path(os.environ.get("MESHY_ENV_FILE", Path.home() / "Desktop" / "Meshy" / ".env"))
API = "https://api.meshy.ai/openapi/v1/multi-image-to-3d"
REFS = ROOT / "assets" / "references-v14" / "city"
OUT = ROOT / "public" / "models-v14" / "city"
TASKS = ROOT / "assets" / "meshy-tasks-v14"
VIEWS = ("front", "left", "rear", "right")
BUILDINGS = ("simple-house-e", "simple-house-f", "simple-house-g", "simple-house-h")


def api_key():
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("MESHY_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("MESHY_API_KEY not found")


def request(method, url, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {api_key()}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.load(response)


def data_uri(path):
    mime = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def generate(name):
    OUT.mkdir(parents=True, exist_ok=True)
    TASKS.mkdir(parents=True, exist_ok=True)
    output = OUT / f"{name}.glb"
    journal = TASKS / f"{name}.json"
    state = json.loads(journal.read_text(encoding="utf-8")) if journal.exists() else {}

    if not state.get("task_id"):
        images = [data_uri(REFS / f"{name}-{view}.jpg") for view in VIEWS]
        created = request("POST", API, {
            "image_urls": images,
            "ai_model": "meshy-7",
            "should_texture": True,
            "texture_image_urls": images,
            "enable_pbr": False,
            "texture_resolution": "2k",
            "should_remesh": True,
            "topology": "triangle",
            "target_polycount": 4500,
        })
        state = {"task_id": created["result"], "source": str(REFS), "views": list(VIEWS)}
        journal.write_text(json.dumps(state, indent=2), encoding="utf-8")

    while True:
        task = request("GET", f"{API}/{state['task_id']}")
        print(f"{name}: {task.get('status')} {task.get('progress', 0)}%", flush=True)
        if task.get("status") == "SUCCEEDED":
            break
        if task.get("status") in {"FAILED", "CANCELED"}:
            state.update(status=task.get("status"), error=task.get("task_error"))
            journal.write_text(json.dumps(state, indent=2), encoding="utf-8")
            raise RuntimeError(task.get("task_error") or task.get("status"))
        time.sleep(10)

    urllib.request.urlretrieve(task["model_urls"]["glb"], output)
    state.update(status="downloaded", output=str(output), bytes=output.stat().st_size,
                 credits=task.get("consumed_credits"))
    journal.write_text(json.dumps(state, indent=2), encoding="utf-8")
    return output


def main():
    failures = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(generate, name): name for name in BUILDINGS}
        for future in as_completed(futures):
            name = futures[future]
            try:
                output = future.result()
                print(f"READY {name} {output.stat().st_size} bytes", flush=True)
            except Exception as error:
                failures.append((name, str(error)))
                print(f"FAILED {name}: {error}", flush=True)
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
