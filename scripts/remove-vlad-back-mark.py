from __future__ import annotations

import io
import json
import shutil
import struct
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "models-v36" / "characters"
OUTPUT = ROOT / "public" / "models-v37" / "characters"
BACK_MARK_BOXES = ((741, 1873, 806, 1925), (747, 1479, 779, 1524), (1328, 132, 1359, 169))


def remove_back_mark(png: bytes) -> bytes:
    image = Image.open(io.BytesIO(png)).convert("RGBA")
    pixels = image.load()
    mask = Image.new("L", image.size)
    mask_pixels = mask.load()
    for left, top, right, bottom in BACK_MARK_BOXES:
        for y in range(max(0, top - 5), min(image.height, bottom + 6)):
            for x in range(max(0, left - 5), min(image.width, right + 6)):
                red, green, blue, _ = pixels[x, y]
                if green > 105 and green > red * 1.25 and green > blue * 1.25:
                    mask_pixels[x, y] = 255
    mask = mask.filter(ImageFilter.MaxFilter(9))
    mask_pixels = mask.load()
    for left, top, right, bottom in BACK_MARK_BOXES:
        samples = []
        for y in range(max(0, top - 14), min(image.height, bottom + 15)):
            for x in range(max(0, left - 14), min(image.width, right + 15)):
                if mask_pixels[x, y] == 0:
                    red, green, blue, _ = pixels[x, y]
                    if max(red, green, blue) < 100:
                        samples.append((red, green, blue))
        base = tuple(sorted(channel)[len(channel) // 2] for channel in zip(*samples)) if samples else (18, 20, 20)
        for y in range(max(0, top - 10), min(image.height, bottom + 11)):
            for x in range(max(0, left - 10), min(image.width, right + 11)):
                if mask_pixels[x, y]:
                    variation = ((x * 17 + y * 31) % 7) - 3
                    pixels[x, y] = tuple(max(0, min(255, value + variation)) for value in base) + (255,)
    encoded = io.BytesIO()
    image.save(encoded, format="PNG", optimize=True)
    return encoded.getvalue()


def rewrite_glb(source: Path, destination: Path) -> None:
    raw = source.read_bytes()
    json_length, _ = struct.unpack_from("<II", raw, 12)
    document = json.loads(raw[20:20 + json_length].decode("utf-8").rstrip("\0 "))
    binary_header = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", raw, binary_header)
    binary = raw[binary_header + 8:binary_header + 8 + binary_length]
    image = document["images"][0]
    image_view = document["bufferViews"][image["bufferView"]]
    start = image_view.get("byteOffset", 0)
    old_length = image_view["byteLength"]
    following_offsets = [view.get("byteOffset", 0) for view in document["bufferViews"] if view.get("byteOffset", 0) > start]
    end = min(following_offsets) if following_offsets else len(binary)
    replacement = remove_back_mark(binary[start:start + old_length])
    replacement_padded = replacement + b"\0" * ((4 - len(replacement) % 4) % 4)
    new_binary = binary[:start] + replacement_padded + binary[end:]
    delta = len(replacement_padded) - (end - start)
    image_view["byteLength"] = len(replacement)
    for view in document["bufferViews"]:
        if view.get("byteOffset", 0) >= end:
            view["byteOffset"] += delta
    document["buffers"][0]["byteLength"] = len(new_binary)
    json_bytes = json.dumps(document, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    new_binary += b"\0" * ((4 - len(new_binary) % 4) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(new_binary)
    result = struct.pack("<4sII", b"glTF", 2, total)
    result += struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
    result += struct.pack("<II", len(new_binary), binary_type) + new_binary
    destination.write_bytes(result)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for source in SOURCE.glob("vlad-tenev-*.glb"):
        destination = OUTPUT / source.name
        rewrite_glb(source, destination)
        print(f"wrote {destination.name}: {destination.stat().st_size} bytes")


if __name__ == "__main__":
    main()
