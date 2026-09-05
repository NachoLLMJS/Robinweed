import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable
GENERATOR = ROOT / "scripts" / "image-to-meshy.py"

ASSETS = [
    ("warehouse/concrete-wall", 2200, None),
    ("warehouse/loading-door", 2600, None),
    ("warehouse/grow-bench", 2200, None),
    ("warehouse/shelf", 2200, None),
    ("warehouse/grow-light", 1800, None),
    ("warehouse/vendor-counter", 2200, None),
    ("city/shopfront", 5000, None),
    ("city/apartment-block", 5000, None),
    ("city/street-sidewalk", 1800, None),
    ("characters/milo-front", 7000, "a-pose"),
]


def generate(item):
    name, polycount, pose = item
    image = ROOT / "assets" / "references-v3" / f"{name}.png"
    output = ROOT / "public" / "models-v3" / f"{name}.glb"
    journal = ROOT / "assets" / "meshy-tasks-v3" / f"{name}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    journal.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        PYTHON,
        str(GENERATOR),
        "--image", str(image),
        "--output", str(output),
        "--journal", str(journal),
        "--polycount", str(polycount),
    ]
    if pose:
        cmd += ["--pose-mode", pose]
    completed = subprocess.run(cmd, cwd=ROOT, text=True)
    if completed.returncode:
        raise RuntimeError(f"{name} failed with exit code {completed.returncode}")
    return name, output.stat().st_size


def main():
    failures = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(generate, asset): asset[0] for asset in ASSETS}
        for future in as_completed(futures):
            name = futures[future]
            try:
                _, size = future.result()
                print(f"READY {name} {size} bytes", flush=True)
            except Exception as error:
                failures.append((name, str(error)))
                print(f"FAILED {name}: {error}", flush=True)
    if failures:
        for name, error in failures:
            print(f"ERROR {name}: {error}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
