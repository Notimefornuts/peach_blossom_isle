"""Reduce the three user-supplied GLBs and bake their albedo into vertex colors.
Usage: python tools/prepare_courtyard_models.py /path/to/original/glbs
Optional build dependencies: numpy scipy Pillow fast-simplification trimesh.
The delivered application uses the prepared files and does not need Python.
"""
from pathlib import Path
import sys, json, struct, io, os
if os.environ.get('PEACH_MESH_TOOLS'):
    sys.path.insert(0, os.environ['PEACH_MESH_TOOLS'])
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation
import fast_simplification
import trimesh

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
DTYPES = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}
COUNTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_model(path):
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    meta = json.loads(data[20:20 + size])
    raw = data[28 + size:]
    def accessor(index):
        acc = meta['accessors'][index]; view = meta['bufferViews'][acc['bufferView']]
        offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        return np.frombuffer(raw, dtype=DTYPES[acc['componentType']], count=acc['count'] * COUNTS[acc['type']], offset=offset).reshape(acc['count'], COUNTS[acc['type']]).copy()
    primitive = meta['meshes'][0]['primitives'][0]
    points = accessor(primitive['attributes']['POSITION']).astype(np.float64)
    faces = accessor(primitive['indices']).reshape(-1, 3).astype(np.int32)
    uv = accessor(primitive['attributes']['TEXCOORD_0'])
    node = meta['nodes'][0]
    points = Rotation.from_quat(node.get('rotation', [0, 0, 0, 1])).apply(points)
    points *= np.array(node.get('scale', [1, 1, 1]))
    points += np.array(node.get('translation', [0, 0, 0]))
    minimum, maximum = points.min(0), points.max(0)
    points -= np.array([(minimum[0] + maximum[0]) / 2, minimum[1], (minimum[2] + maximum[2]) / 2])
    points /= max(maximum[0] - minimum[0], maximum[2] - minimum[2])
    material = meta['materials'][primitive.get('material', 0)]
    texture_index = material['pbrMetallicRoughness']['baseColorTexture']['index']
    image = meta['images'][meta['textures'][texture_index]['source']]
    view = meta['bufferViews'][image['bufferView']]
    pixels = np.asarray(Image.open(io.BytesIO(raw[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']])).convert('RGB'))
    h, w = pixels.shape[:2]
    x = np.clip((uv[:, 0] * (w - 1)).astype(int), 0, w - 1)
    y = np.clip((uv[:, 1] * (h - 1)).astype(int), 0, h - 1)
    rgb = pixels[y, x].astype(np.float64) / 255
    luminance = rgb @ np.array([.2126, .7152, .0722])
    rgb = np.clip((luminance[:, None] + (rgb - luminance[:, None]) * .84) * 1.025, 0, 1)
    return points, faces, rgb


def write_glb(path, points, faces, normals, colors, glow=False):
    parts = []; views = []; accessors = []
    def append(array, component, kind, target=None):
        array = np.ascontiguousarray(array)
        data = array.tobytes(); offset = sum(len(p) for p in parts)
        padded = data + b'\0' * (-len(data) % 4); parts.append(padded)
        view = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)}
        if target: view['target'] = target
        views.append(view)
        acc = {'bufferView': len(views) - 1, 'componentType': component, 'count': len(array), 'type': kind}
        if kind == 'VEC3' and component == 5126:
            acc.update(min=array.min(0).tolist(), max=array.max(0).tolist())
        if component == 5121: acc['normalized'] = True
        accessors.append(acc); return len(accessors) - 1
    pos = append(points.astype('<f4'), 5126, 'VEC3', 34962)
    normal = append(normals.astype('<f4'), 5126, 'VEC3', 34962)
    linear = np.where(colors <= .04045, colors / 12.92, ((colors + .055) / 1.055) ** 2.4)
    color = append(np.round(np.c_[linear, np.ones(len(linear))] * 255).astype('u1'), 5121, 'VEC4', 34962)
    mask = np.zeros(len(faces), dtype=bool)
    if glow:
        avg = colors[faces].mean(1); height = points[faces, 1].mean(1)
        mask = (avg[:, 0] > .68) & (avg[:, 1] > .40) & (avg[:, 2] < .50) & (avg[:, 0] > avg[:, 2] * 1.35) & (height > points[:, 1].max() * .45) & (height < points[:, 1].max() * .78)
    primitives = []
    for glowing in [False, True]:
        subset = faces[mask if glowing else ~mask]
        if not len(subset): continue
        index = append(subset.astype('<u2').reshape(-1), 5123, 'SCALAR', 34963)
        primitives.append({'attributes': {'POSITION': pos, 'NORMAL': normal, 'COLOR_0': color}, 'indices': index, 'material': int(glowing)})
    mats = [{'name': 'Garden natural matte', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'roughnessFactor': .88, 'metallicFactor': 0}}, {'name': 'Warm lantern openings', 'doubleSided': True, 'emissiveFactor': [1, .56, .22], 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'roughnessFactor': .8, 'metallicFactor': 0}}]
    meta = {'asset': {'version': '2.0', 'generator': 'Peach Isle model preparation'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': path.stem}], 'meshes': [{'primitives': primitives}], 'materials': mats, 'buffers': [{'byteLength': sum(len(p) for p in parts)}], 'bufferViews': views, 'accessors': accessors}
    text = json.dumps(meta, separators=(',', ':')).encode(); text += b' ' * (-len(text) % 4)
    raw = b''.join(parts); total = 12 + 8 + len(text) + 8 + len(raw)
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, total) + struct.pack('<II', len(text), 0x4e4f534a) + text + struct.pack('<II', len(raw), 0x004e4942) + raw)
    return int(mask.sum())


report = []
for original, name, targets in [('拱桥', 'bridge', [16000, 8000]), ('蒲团', 'cushion', [10000, 4000]), ('石灯', 'lantern', [10000, 5000])]:
    path = Path(sys.argv[1]) / (original + '.glb')
    points, faces, colors = read_model(path)
    tree = cKDTree(points)
    # The originals duplicate vertices along UV seams. Decimating those open
    # boundaries independently tears the planks and woven edges apart.
    welded = trimesh.Trimesh(vertices=points, faces=faces, process=False)
    welded.merge_vertices(digits_vertex=6)
    source_points = welded.vertices.copy()
    source_faces = welded.faces.astype(np.int32)
    for tier, target in zip(['high', 'low'], targets):
        vertices, indices = fast_simplification.simplify(source_points, source_faces, target_count=target, agg=7)
        _, nearest = tree.query(vertices, k=1)
        baked = colors[nearest]
        mesh = trimesh.Trimesh(vertices=vertices, faces=indices, process=False)
        output = OUT / (name + '-' + tier + '.glb')
        glow = write_glb(output, vertices, indices, mesh.vertex_normals, baked, name == 'lantern')
        row = {'name': name, 'tier': tier, 'sourceFaces': len(faces), 'faces': len(indices), 'vertices': len(vertices), 'bytes': output.stat().st_size, 'bounds': [vertices.min(0).tolist(), vertices.max(0).tolist()], 'glowFaces': glow}
        report.append(row); print(json.dumps(row), flush=True)
(OUT / 'model-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
