"""Prepare the supplied stone arch for real-time Three.js rendering.

Run: python tools/prepare_stone_bridge.py /path/to/石头拱桥.glb
Requires numpy, scipy, Pillow and Blender on PATH. These are only needed
when preparing the model again; the delivered website uses the prepared GLBs.
"""
from pathlib import Path
import io, json, os, struct, subprocess, sys, tempfile

ROOT = Path(__file__).resolve().parents[1]


def blender_worker():
    import bpy
    import numpy as np

    args = sys.argv[sys.argv.index('--') + 1:]
    source, output = Path(args[1]), Path(args[2])
    data = np.load(source)
    verts, faces = data['vertices'], data['faces']
    mesh = bpy.data.meshes.new('Welded stone arch')
    mesh.vertices.add(len(verts))
    mesh.vertices.foreach_set('co', verts.ravel())
    mesh.loops.add(faces.size)
    mesh.loops.foreach_set('vertex_index', faces.ravel())
    mesh.polygons.add(len(faces))
    mesh.polygons.foreach_set('loop_start', np.arange(len(faces), dtype=np.int32) * 3)
    mesh.polygons.foreach_set('loop_total', np.full(len(faces), 3, dtype=np.int32))
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new('Stone arch', mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for tier, target in [('high', 22000), ('low', 10000)]:
        modifier = obj.modifiers.new('Preserve stone arch silhouette', 'DECIMATE')
        modifier.ratio = min(1, target / len(faces))
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        result = evaluated.to_mesh()
        result.calc_loop_triangles()
        p = np.empty(len(result.vertices) * 3, dtype=np.float32)
        result.vertices.foreach_get('co', p)
        f = np.empty(len(result.loop_triangles) * 3, dtype=np.int32)
        result.loop_triangles.foreach_get('vertices', f)
        np.savez_compressed(output / (tier + '.npz'), vertices=p.reshape(-1, 3), faces=f.reshape(-1, 3))
        print('DECIMATED', tier, len(p) // 3, len(f) // 3, flush=True)
        evaluated.to_mesh_clear()
        obj.modifiers.remove(modifier)


def write_glb(path, vertices, faces, colors):
    import numpy as np
    triangles = vertices[faces]
    face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    normals = np.zeros_like(vertices)
    for i in range(3):
        np.add.at(normals, faces[:, i], face_normals)
    norm = np.linalg.norm(normals, axis=1, keepdims=True)
    normals /= np.maximum(norm, 1e-12)
    chunks, views, accessors = [], [], []

    def add(array, component, kind, target):
        array = np.ascontiguousarray(array)
        raw = array.tobytes()
        offset = sum(len(c) for c in chunks)
        chunks.append(raw + b'\0' * (-len(raw) % 4))
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(raw), 'target': target})
        acc = {'bufferView': len(views) - 1, 'componentType': component, 'count': len(array), 'type': kind}
        if kind == 'VEC3' and component == 5126:
            acc.update(min=array.min(0).tolist(), max=array.max(0).tolist())
        if component == 5121:
            acc['normalized'] = True
        accessors.append(acc)
        return len(accessors) - 1

    position = add(vertices.astype('<f4'), 5126, 'VEC3', 34962)
    normal = add(normals.astype('<f4'), 5126, 'VEC3', 34962)
    linear = np.where(colors <= .04045, colors / 12.92, ((colors + .055) / 1.055) ** 2.4)
    color = add(np.round(np.c_[linear, np.ones(len(linear))] * 255).astype('u1'), 5121, 'VEC4', 34962)
    if len(vertices) >= 65536:
        raise ValueError('Prepared tier exceeds the 16-bit vertex limit')
    index = add(faces.astype('<u2').reshape(-1), 5123, 'SCALAR', 34963)
    meta = {'asset': {'version': '2.0', 'generator': 'Peach Isle stone bridge preparation'},
            'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': path.stem}],
            'meshes': [{'primitives': [{'attributes': {'POSITION': position, 'NORMAL': normal, 'COLOR_0': color},
                                        'indices': index, 'material': 0}]}],
            'materials': [{'name': 'Natural stone', 'doubleSided': True,
                           'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1],
                                                     'roughnessFactor': .92, 'metallicFactor': 0}}],
            'buffers': [{'byteLength': sum(map(len, chunks))}], 'bufferViews': views, 'accessors': accessors}
    text = json.dumps(meta, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    binary = b''.join(chunks)
    total = 12 + 8 + len(text) + 8 + len(binary)
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, total) + struct.pack('<II', len(text), 0x4e4f534a)
                     + text + struct.pack('<II', len(binary), 0x004e4942) + binary)


def main():
    import numpy as np
    from PIL import Image
    from scipy.spatial import cKDTree
    from scipy.spatial.transform import Rotation

    source = Path(sys.argv[1]).resolve()
    blob = source.read_bytes()
    if blob[:4] != b'glTF':
        raise ValueError('Expected a binary glTF model')
    size = struct.unpack_from('<I', blob, 12)[0]
    meta = json.loads(blob[20:20 + size])
    binary = memoryview(blob)[28 + size:]
    types = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}
    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def accessor(index):
        a = meta['accessors'][index]
        v = meta['bufferViews'][a['bufferView']]
        offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(binary, dtype=types[a['componentType']], count=a['count'] * components[a['type']],
                             offset=offset).reshape(a['count'], components[a['type']]).copy()

    primitive = meta['meshes'][0]['primitives'][0]
    points = accessor(primitive['attributes']['POSITION']).astype(np.float64)
    faces = accessor(primitive['indices']).reshape(-1, 3).astype(np.int32)
    uv = accessor(primitive['attributes']['TEXCOORD_0'])
    node = meta['nodes'][0]
    points = Rotation.from_quat(node.get('rotation', [0, 0, 0, 1])).apply(points)
    points *= np.asarray(node.get('scale', [1, 1, 1]))
    points += np.asarray(node.get('translation', [0, 0, 0]))
    lo, hi = points.min(0), points.max(0)
    points -= [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]
    points /= max(hi[0] - lo[0], hi[2] - lo[2])
    material = meta['materials'][primitive.get('material', 0)]
    image_index = meta['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
    image = meta['images'][image_index]
    view = meta['bufferViews'][image['bufferView']]
    image_data = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
    pixels = np.asarray(Image.open(io.BytesIO(image_data)).convert('RGB'))
    h, w = pixels.shape[:2]
    x = np.clip((uv[:, 0] * (w - 1)).astype(int), 0, w - 1)
    y = np.clip((uv[:, 1] * (h - 1)).astype(int), 0, h - 1)
    colors = pixels[y, x].astype(np.float64) / 255
    tree = cKDTree(points)
    # Weld coincident UV seam vertices before decimation to avoid torn stone.
    welded, inverse = np.unique(np.round(points, 6), axis=0, return_inverse=True)
    welded_faces = inverse[faces].astype(np.int32)
    valid = ((welded_faces[:, 0] != welded_faces[:, 1]) & (welded_faces[:, 1] != welded_faces[:, 2]) &
             (welded_faces[:, 0] != welded_faces[:, 2]))
    welded_faces = welded_faces[valid]
    output = ROOT / 'assets' / 'models'
    output.mkdir(parents=True, exist_ok=True)
    report = []
    with tempfile.TemporaryDirectory(prefix='peach-stone-') as temp:
        temp = Path(temp)
        np.savez_compressed(temp / 'source.npz', vertices=welded.astype(np.float32), faces=welded_faces)
        subprocess.run(['blender', '-b', '-t', '4', '--python', str(Path(__file__).resolve()), '--',
                        '--worker', str(temp / 'source.npz'), str(temp)], check=True)
        for tier in ['high', 'low']:
            data = np.load(temp / (tier + '.npz'))
            vertices, indices = data['vertices'], data['faces']
            _, nearest = tree.query(vertices, k=1)
            path = output / ('stone-bridge-' + tier + '.glb')
            write_glb(path, vertices, indices, colors[nearest])
            report.append({'tier': tier, 'sourceFaces': len(faces), 'faces': len(indices),
                           'vertices': len(vertices), 'bytes': path.stat().st_size,
                           'bounds': [vertices.min(0).tolist(), vertices.max(0).tolist()]})
    (output / 'stone-bridge-report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    if '--worker' in sys.argv:
        blender_worker()
    else:
        main()
