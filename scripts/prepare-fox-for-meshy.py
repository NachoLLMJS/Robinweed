"""Strip the legacy Sketchfab rig while preserving the fox mesh and texture.

The source mesh itself is Y-up and faces glTF +Z. Parent FBX conversion
matrices make the old skinned scene unsuitable for Meshy pose estimation.
"""
from __future__ import annotations

import json
import struct
from pathlib import Path

SOURCE = Path(r"C:\Users\nacho\Desktop\fox glb.glb")
OUTPUT = Path(__file__).resolve().parents[1] / "artifacts" / "meshy" / "fox-walker" / "fox-meshy-input.glb"


def main():
    raw = SOURCE.read_bytes()
    if raw[:4] != b"glTF": raise RuntimeError("Source is not a binary glTF")
    json_len, json_type = struct.unpack_from("<I4s", raw, 12)
    if json_type != b"JSON": raise RuntimeError("First GLB chunk is not JSON")
    doc = json.loads(raw[20:20+json_len].decode("utf-8").rstrip())
    bin_header = 20 + json_len
    bin_len, bin_type = struct.unpack_from("<I4s", raw, bin_header)
    bin_data = raw[bin_header+8:bin_header+8+bin_len]
    primitive = doc["meshes"][0]["primitives"][0]
    primitive["attributes"] = {
        key: value for key, value in primitive["attributes"].items()
        if key in {"POSITION", "NORMAL", "TEXCOORD_0"}
    }
    doc["nodes"] = [{"name": "Fox_Meshy_Input", "mesh": 0}]
    doc["scenes"] = [{"name": "Fox_Meshy_Input", "nodes": [0]}]
    doc["scene"] = 0
    doc.pop("skins", None)
    doc.pop("animations", None)
    doc["asset"]["generator"] = "Robinweed Meshy input cleanup"
    json_data = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    json_data += b" " * ((4 - len(json_data) % 4) % 4)
    bin_data += b"\0" * ((4 - len(bin_data) % 4) % 4)
    total = 12 + 8 + len(json_data) + 8 + len(bin_data)
    output = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    output += struct.pack("<I4s", len(json_data), b"JSON") + json_data
    output += struct.pack("<I4s", len(bin_data), bin_type) + bin_data
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(output)
    print(f"Prepared Meshy input: {OUTPUT} ({len(output)} bytes)")


if __name__ == "__main__": main()
