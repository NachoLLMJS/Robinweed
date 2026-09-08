from __future__ import annotations

import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "models-v24" / "characters" / "househead-source.glb"
OUTPUT = ROOT / "public" / "models-v24" / "characters" / "househead-idle.glb"


def align4(data: bytes, fill: bytes = b"\0") -> bytes:
    return data + fill * ((-len(data)) % 4)


def quaternion_yz(yaw: float, roll: float) -> tuple[float, float, float, float]:
    # q = yaw(Y) * roll(Z), glTF order x, y, z, w.
    sy, cy = math.sin(yaw / 2), math.cos(yaw / 2)
    sz, cz = math.sin(roll / 2), math.cos(roll / 2)
    return (sy * sz, sy * cz, cy * sz, cy * cz)


def pack_floats(values: list[float] | list[tuple[float, ...]]) -> bytes:
    flat: list[float] = []
    for value in values:
        if isinstance(value, tuple):
            flat.extend(value)
        else:
            flat.append(value)
    return struct.pack("<" + "f" * len(flat), *flat)


def main() -> None:
    raw = SOURCE.read_bytes()
    magic, version, total = struct.unpack_from("<III", raw, 0)
    if magic != 0x46546C67 or version != 2 or total != len(raw):
        raise RuntimeError("Source is not a valid GLB 2.0 container")

    offset = 12
    chunks: list[tuple[int, bytes]] = []
    while offset < len(raw):
        length, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunks.append((chunk_type, raw[offset:offset + length]))
        offset += length
    json_chunk = next(data for kind, data in chunks if kind == 0x4E4F534A)
    bin_chunk = next(data for kind, data in chunks if kind == 0x004E4942)
    document = json.loads(json_chunk.decode("utf-8").rstrip(" \0"))

    times = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
    translations = [
        (0.000, 0.000, 0.000),
        (-0.006, 0.012, 0.002),
        (-0.010, 0.021, 0.004),
        (-0.005, 0.012, 0.002),
        (0.000, 0.000, 0.000),
        (0.006, 0.012, -0.002),
        (0.010, 0.021, -0.004),
        (0.005, 0.012, -0.002),
        (0.000, 0.000, 0.000),
    ]
    rotations = [
        quaternion_yz(0.000, 0.000),
        quaternion_yz(-0.012, 0.010),
        quaternion_yz(-0.020, 0.015),
        quaternion_yz(-0.012, 0.010),
        quaternion_yz(0.000, 0.000),
        quaternion_yz(0.012, -0.010),
        quaternion_yz(0.020, -0.015),
        quaternion_yz(0.012, -0.010),
        quaternion_yz(0.000, 0.000),
    ]
    scales = [
        (1.000, 1.000, 1.000),
        (0.998, 1.006, 0.998),
        (0.996, 1.012, 0.996),
        (0.998, 1.006, 0.998),
        (1.000, 1.000, 1.000),
        (0.998, 1.006, 0.998),
        (0.996, 1.012, 0.996),
        (0.998, 1.006, 0.998),
        (1.000, 1.000, 1.000),
    ]

    binary = bytearray(bin_chunk)
    views = document.setdefault("bufferViews", [])
    accessors = document.setdefault("accessors", [])

    def append_accessor(data: bytes, component_type: int, count: int, kind: str, minimum=None, maximum=None) -> int:
        while len(binary) % 4:
            binary.append(0)
        byte_offset = len(binary)
        binary.extend(data)
        view_index = len(views)
        views.append({"buffer": 0, "byteOffset": byte_offset, "byteLength": len(data)})
        accessor = {
            "bufferView": view_index,
            "byteOffset": 0,
            "componentType": component_type,
            "count": count,
            "type": kind,
        }
        if minimum is not None:
            accessor["min"] = minimum
        if maximum is not None:
            accessor["max"] = maximum
        accessor_index = len(accessors)
        accessors.append(accessor)
        return accessor_index

    time_accessor = append_accessor(pack_floats(times), 5126, len(times), "SCALAR", [min(times)], [max(times)])
    translation_accessor = append_accessor(pack_floats(translations), 5126, len(translations), "VEC3")
    rotation_accessor = append_accessor(pack_floats(rotations), 5126, len(rotations), "VEC4")
    scale_accessor = append_accessor(pack_floats(scales), 5126, len(scales), "VEC3")

    node = document["nodes"][0]
    node.pop("matrix", None)
    node["translation"] = [0, 0, 0]
    node["rotation"] = [0, 0, 0, 1]
    node["scale"] = [1, 1, 1]
    document["animations"] = [{
        "name": "Househead_Idle",
        "samplers": [
            {"input": time_accessor, "output": translation_accessor, "interpolation": "LINEAR"},
            {"input": time_accessor, "output": rotation_accessor, "interpolation": "LINEAR"},
            {"input": time_accessor, "output": scale_accessor, "interpolation": "LINEAR"},
        ],
        "channels": [
            {"sampler": 0, "target": {"node": 0, "path": "translation"}},
            {"sampler": 1, "target": {"node": 0, "path": "rotation"}},
            {"sampler": 2, "target": {"node": 0, "path": "scale"}},
        ],
    }]
    document["buffers"][0]["byteLength"] = len(binary)

    encoded_json = align4(json.dumps(document, separators=(",", ":")).encode("utf-8"), b" ")
    encoded_bin = align4(bytes(binary))
    total_length = 12 + 8 + len(encoded_json) + 8 + len(encoded_bin)
    result = bytearray(struct.pack("<III", 0x46546C67, 2, total_length))
    result.extend(struct.pack("<II", len(encoded_json), 0x4E4F534A))
    result.extend(encoded_json)
    result.extend(struct.pack("<II", len(encoded_bin), 0x004E4942))
    result.extend(encoded_bin)
    OUTPUT.write_bytes(result)
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
