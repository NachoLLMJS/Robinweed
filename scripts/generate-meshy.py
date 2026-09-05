import json
import os
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = Path(os.environ.get("MESHY_ENV_FILE", Path.home() / "Desktop" / "Meshy" / ".env"))
OUT = ROOT / "public" / "models" / "watering-can.glb"
JOURNAL = ROOT / "meshy-task.json"
API = "https://api.meshy.ai/openapi/v2/text-to-3d"


def api_key():
    key_name = "MESHY_API_KEY"
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith(key_name + "="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError(f"{key_name} not found")


def request(method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {api_key()}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=90) as res:
        return json.load(res)


def wait_task(task_id):
    while True:
        task = request("GET", f"{API}/{task_id}")
        print(f"{task.get('type')}: {task.get('status')} {task.get('progress', 0)}%", flush=True)
        if task.get("status") == "SUCCEEDED":
            return task
        if task.get("status") in {"FAILED", "CANCELED"}:
            raise RuntimeError(task.get("task_error") or task.get("status"))
        time.sleep(8)


def save_journal(**values):
    current = json.loads(JOURNAL.read_text()) if JOURNAL.exists() else {}
    current.update(values)
    JOURNAL.write_text(json.dumps(current, indent=2), encoding="utf-8")
    return current


OUT.parent.mkdir(parents=True, exist_ok=True)
state = json.loads(JOURNAL.read_text()) if JOURNAL.exists() else {}
if not state.get("preview_id"):
    created = request("POST", API, {
        "mode": "preview",
        "prompt": "single compact garden watering can, chunky low-poly indie game prop, short spout, top handle, clean silhouette, no plants, no text, no logo, isolated object",
        "model_type": "smart-topology",
        "ai_model": "meshy-t2",
        "topology": "triangle",
        "target_polycount": 1400,
        "target_formats": ["glb"],
        "moderation": True,
    })
    state = save_journal(preview_id=created["result"])
preview = wait_task(state["preview_id"])
if not state.get("refine_id"):
    created = request("POST", API, {
        "mode": "refine",
        "preview_task_id": state["preview_id"],
        "texture_prompt": "matte forest green painted metal with a cream handle, subtle wear, stylized low-poly game asset, no text, no logo",
        "enable_pbr": False,
        "texture_resolution": "2k",
        "target_formats": ["glb"],
        "moderation": True,
    })
    state = save_journal(refine_id=created["result"])
refined = wait_task(state["refine_id"])
url = refined["model_urls"]["glb"]
urllib.request.urlretrieve(url, OUT)
save_journal(status="downloaded", output=str(OUT), credits=refined.get("consumed_credits"))
print(f"Downloaded: {OUT} ({OUT.stat().st_size} bytes)", flush=True)
