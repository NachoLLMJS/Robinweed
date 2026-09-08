from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = Path(os.environ.get("MESHY_ENV_FILE", r"C:\Users\nacho\Desktop\Meshy\.env"))
REFERENCE_DIR = ROOT / "artifacts" / "meshy" / "warehouse-expansion" / "references"
JOURNAL_DIR = ROOT / "artifacts" / "meshy" / "warehouse-expansion" / "journals"
OUTPUT_DIR = ROOT / "public" / "models-v33" / "warehouse"
BASE_URL = "https://api.meshy.ai/openapi/v1"
TERMINAL = {"SUCCEEDED", "FAILED", "CANCELED", "EXPIRED"}
ASSETS = {
    "soil-pallet": "soil-pallet.png",
    "hvac-duct": "hvac-duct.png",
    "exhaust-fan": "exhaust-fan.png",
    "recycling-bin": "recycling-bin.png",
}


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


def response_id(value) -> str:
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


def find_glb(result) -> str:
    for container in (result.get("model_urls", {}), result, result.get("result", {})):
        if not isinstance(container, dict):
            continue
        for field in ("glb", "model_glb_url", "output_glb_url"):
            value = container.get(field)
            if isinstance(value, str) and value.startswith("http"):
                return value
    raise RuntimeError("Meshy task completed without a GLB URL")


def run_asset(key: str, slug: str, reference_name: str):
    reference = REFERENCE_DIR / reference_name
    journal_path = JOURNAL_DIR / f"{slug}.json"
    output = OUTPUT_DIR / f"{slug}.glb"
    if not reference.exists():
        raise FileNotFoundError(reference)
    journal = json.loads(journal_path.read_text(encoding="utf-8")) if journal_path.exists() else {
        "slug": slug,
        "reference": str(reference),
    }
    task_id = journal.get("task_id")
    if task_id:
        print(f"{slug}: resuming {task_id}", flush=True)
    else:
        image_uri = "data:image/png;base64," + base64.b64encode(reference.read_bytes()).decode()
        task_id = response_id(request_json(key, "POST", "/image-to-3d", {
            "image_url": image_uri,
            "enable_pbr": False,
            "should_texture": True,
            "should_remesh": True,
            "target_polycount": 12000,
            "topology": "triangle",
        }))
        journal["task_id"] = task_id
        JOURNAL_DIR.mkdir(parents=True, exist_ok=True)
        journal_path.write_text(json.dumps(journal, indent=2), encoding="utf-8")
        print(f"{slug}: created {task_id}", flush=True)

    last_status = None
    while True:
        result = request_json(key, "GET", f"/image-to-3d/{task_id}")
        status = str(result.get("status", "")).upper()
        if status != last_status:
            print(f"{slug}: {status}", flush=True)
            last_status = status
        journal.update({"status": status, "result": result})
        journal_path.write_text(json.dumps(journal, indent=2), encoding="utf-8")
        if status in TERMINAL:
            if status != "SUCCEEDED":
                raise RuntimeError(f"{slug}: Meshy generation failed: {status}")
            break
        time.sleep(8)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(find_glb(result), timeout=180) as response:
        output.write_bytes(response.read())
    journal["complete"] = True
    journal_path.write_text(json.dumps(journal, indent=2), encoding="utf-8")
    print(f"{slug}: downloaded {output} ({output.stat().st_size} bytes)", flush=True)
    return slug, str(output), output.stat().st_size


def main():
    key = load_key()
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(run_asset, key, slug, reference) for slug, reference in ASSETS.items()]
        for future in as_completed(futures):
            slug, output, size = future.result()
            print(f"complete: {slug} {size} bytes -> {output}", flush=True)


if __name__ == "__main__":
    main()
