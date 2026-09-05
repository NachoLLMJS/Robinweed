from pathlib import Path
import trimesh
from trimesh.visual.material import SimpleMaterial

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/models-v8/warehouse/automatic-loading-door.glb'
FRAME = ROOT / 'public/models-v8/warehouse/automatic-loading-door-frame.glb'
LEAF = ROOT / 'public/models-v8/warehouse/automatic-loading-door-leaf.glb'

scene = trimesh.load(SOURCE, force='scene')
if len(scene.geometry) != 1:
    raise RuntimeError(f'Expected one Meshy geometry, found {len(scene.geometry)}')
mesh = next(iter(scene.geometry.values())).copy()
centers = mesh.triangles_center

# Meshy returns one textured mesh. The shutter occupies the central opening;
# rails, motor and lintel remain in the complementary static region.
leaf_mask = (
    (centers[:, 0] > -0.285)
    & (centers[:, 0] < 0.285)
    & (centers[:, 1] < 0.275)
)
frame_mask = ~leaf_mask

leaf = mesh.copy()
leaf.update_faces(leaf_mask)
leaf.update_faces(leaf.nondegenerate_faces())
leaf.remove_unreferenced_vertices()
frame = mesh.copy()
frame.update_faces(frame_mask)
frame.update_faces(frame.nondegenerate_faces())
frame.remove_unreferenced_vertices()

if len(leaf.faces) < 500 or len(frame.faces) < 500:
    raise RuntimeError(f'Unexpected split: leaf={len(leaf.faces)} frame={len(frame.faces)}')

FRAME.parent.mkdir(parents=True, exist_ok=True)
texture = mesh.visual.material.baseColorTexture
for part, destination in ((frame, FRAME), (leaf, LEAF)):
    part.visual.material = SimpleMaterial(image=texture)
    payload = trimesh.exchange.gltf.export_glb(trimesh.Scene(part), include_normals=True)
    destination.write_bytes(payload)
print(f'frame faces={len(frame.faces)} bytes={FRAME.stat().st_size}')
print(f'leaf faces={len(leaf.faces)} bytes={LEAF.stat().st_size}')
