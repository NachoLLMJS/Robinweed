"""Repair the small Meshy-baked blemish in the seed-pack logo.

The repair is baked into the GLB's own base-color texture. It does not add
runtime geometry, decals, planes, or a second logo.
"""
from __future__ import annotations

import json
import math
import shutil
import struct
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EXTRACT = ROOT / "review" / "seed-pack-v6-extract"
GLTF = EXTRACT / "seed-pack.gltf"
BIN = EXTRACT / "seed-pack.bin"
TEXTURE = EXTRACT / "baseColor.jpg"
REFERENCE = ROOT / "assets" / "references-v6" / "items" / "robinhood-seed-pack.png"
MARK = ROOT / "assets" / "references-v6-robinhood-mark.png"
OUTPUT = ROOT / "public" / "models-v6" / "items" / "robinhood-seed-pack.glb"
BACKUP = ROOT / "assets" / "meshy-originals-v6" / "robinhood-seed-pack-original.glb"

# Front-face model coordinates covering only the blemish shown in QA.
REPAIR_X = (-0.19, 0.21)
REPAIR_Y = (-0.17, 0.30)
FEATHER = 0.018

# Approximate package bounds in the approved 1184x1330 source image.
SRC_LEFT, SRC_RIGHT = 282.0, 889.0
SRC_TOP, SRC_BOTTOM = 187.0, 1184.0
MODEL_LEFT, MODEL_RIGHT = -0.310547, 0.314453
MODEL_BOTTOM, MODEL_TOP = -0.5, 0.5


def edge(a, b, p):
    return (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])


def barycentric(a, b, c, p):
    area = edge(a, b, c)
    if abs(area) < 1e-9:
        return None
    return edge(b, c, p) / area, edge(c, a, p) / area, edge(a, b, p) / area


def clean_logo_pixel(mark, model_x, model_y):
    u = (model_x - REPAIR_X[0]) / (REPAIR_X[1] - REPAIR_X[0])
    v = (REPAIR_Y[1] - model_y) / (REPAIR_Y[1] - REPAIR_Y[0])
    mx = max(0, min(mark.width - 1, round(u * (mark.width - 1))))
    my = max(0, min(mark.height - 1, round(v * (mark.height - 1))))
    mark_alpha = mark.getpixel((mx, my))[3] / 255
    # Neutral low-poly green removes the malformed baked mark beneath the clean vector.
    facet = 7 * math.sin(model_x * 31 + model_y * 19)
    background = (max(0, round(27 + facet)), max(0, round(84 + facet)), max(0, round(38 + facet / 2)))
    robinhood_green = (145, 235, 48)
    return tuple(
        round(background[channel] * (1 - mark_alpha) + robinhood_green[channel] * mark_alpha)
        for channel in range(3)
    )


def repair_alpha(x, y):
    dx = min(x - REPAIR_X[0], REPAIR_X[1] - x)
    dy = min(y - REPAIR_Y[0], REPAIR_Y[1] - y)
    return max(0.0, min(1.0, min(dx, dy) / FEATHER))


def main():
    data = json.loads(GLTF.read_text(encoding="utf-8"))
    blob = bytearray(BIN.read_bytes())
    vertex_view = data["bufferViews"][0]
    index_view = data["bufferViews"][1]
    stride = vertex_view["byteStride"]
    vertex_offset = vertex_view.get("byteOffset", 0)
    count = data["accessors"][0]["count"]

    positions = []
    uvs = []
    for i in range(count):
        offset = vertex_offset + i * stride
        positions.append(struct.unpack_from("<3f", blob, offset))
        uvs.append(struct.unpack_from("<2f", blob, offset + 12))

    index_offset = index_view.get("byteOffset", 0)
    index_count = data["accessors"][3]["count"]
    indices = list(struct.unpack_from(f"<{index_count}I", blob, index_offset))

    bad_face_index = 1485
    bad_offset = bad_face_index * 3
    bad_ids = indices[bad_offset : bad_offset + 3]
    bad_normals = [
        struct.unpack_from("<3f", blob, vertex_offset + i * stride + 20)
        for i in bad_ids
    ]
    if sum(normal[2] for normal in bad_normals) / 3 >= -0.5:
        raise RuntimeError("Expected face 1485 to retain its inverted normal")
    indices[bad_offset : bad_offset + 3] = [bad_ids[0], bad_ids[0], bad_ids[0]]
    removed_faces = [bad_face_index]

    struct.pack_into(f"<{index_count}I", blob, index_offset, *indices)
    BIN.write_bytes(blob)

    texture = Image.open(TEXTURE).convert("RGB")
    mark = Image.open(MARK).convert("RGBA")
    pixels = texture.load()
    changed = set()

    for face in range(0, index_count, 3):
        ids = indices[face : face + 3]
        tri3 = [positions[i] for i in ids]
        # The camera-facing package panel is the positive-Z side in the FPS orientation.
        if max(p[2] for p in tri3) < 0.035:
            continue
        tri_uv = [
            (uvs[i][0] * (texture.width - 1), (1.0 - uvs[i][1]) * (texture.height - 1))
            for i in ids
        ]
        min_x = max(0, math.floor(min(p[0] for p in tri_uv)))
        max_x = min(texture.width - 1, math.ceil(max(p[0] for p in tri_uv)))
        min_y = max(0, math.floor(min(p[1] for p in tri_uv)))
        max_y = min(texture.height - 1, math.ceil(max(p[1] for p in tri_uv)))

        for py in range(min_y, max_y + 1):
            for px in range(min_x, max_x + 1):
                weights = barycentric(*tri_uv, (px + 0.5, py + 0.5))
                if weights is None or min(weights) < -1e-5:
                    continue
                model_x = sum(weights[j] * tri3[j][0] for j in range(3))
                model_y = sum(weights[j] * tri3[j][1] for j in range(3))
                if not (REPAIR_X[0] <= model_x <= REPAIR_X[1] and REPAIR_Y[0] <= model_y <= REPAIR_Y[1]):
                    continue
                alpha = repair_alpha(model_x, model_y)
                if alpha <= 0:
                    continue
                old = pixels[px, py]
                clean = clean_logo_pixel(mark, model_x, model_y)
                pixels[px, py] = tuple(round(old[k] * (1 - alpha) + clean[k] * alpha) for k in range(3))
                changed.add((px, py))

    if not changed:
        raise RuntimeError("No texture pixels were repaired")

    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    if not BACKUP.exists():
        BACKUP.write_bytes(OUTPUT.read_bytes())
    texture.save(TEXTURE, quality=97, subsampling=0)
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not npx:
        raise RuntimeError("npx was not found")
    subprocess.run(
        [npx, "--yes", "@gltf-transform/cli@4.5.0", "copy", str(GLTF), str(OUTPUT)],
        cwd=ROOT,
        check=True,
    )
    print(
        f"Removed inverted face {removed_faces[0]}, repaired {len(changed)} atlas pixels, "
        f"and rebuilt {OUTPUT}"
    )


if __name__ == "__main__":
    main()
