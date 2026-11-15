import * as THREE from '../vendor/three.module.js';

const sources = globalThis.ISLE_MODELS ?? {
  'bridge-high.glb': new URL('../assets/models/bridge-high.glb', import.meta.url).href,
  'bridge-low.glb': new URL('../assets/models/bridge-low.glb', import.meta.url).href,
  'cushion-high.glb': new URL('../assets/models/cushion-high.glb', import.meta.url).href,
  'cushion-low.glb': new URL('../assets/models/cushion-low.glb', import.meta.url).href,
  'lantern-high.glb': new URL('../assets/models/lantern-high.glb', import.meta.url).href,
  'lantern-low.glb': new URL('../assets/models/lantern-low.glb', import.meta.url).href
};

// The prepared GLBs contain ordinary uncompressed geometry and baked colors.
// Keeping the small loader local also lets the self-contained HTML run offline.
export function parseGardenModel(buffer) {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid garden model');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  const binaryOffset = 28 + jsonLength;
  const arrays = new Map();
  function attribute(index) {
    if (arrays.has(index)) return arrays.get(index);
    const a = json.accessors[index], b = json.bufferViews[a.bufferView];
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
    const offset = binaryOffset + (b.byteOffset || 0) + (a.byteOffset || 0);
    const raw = new Type(buffer.slice(offset, offset + a.count * size * Type.BYTES_PER_ELEMENT));
    let data = a.normalized ? Float32Array.from(raw, n => n / 255) : raw;
    // All prepared colors are opaque. RGB also matches the CPU renderer's
    // shared three-component color format.
    if (a.type === 'VEC4') {
      data = Float32Array.from({ length: a.count * 3 }, (_, i) => data[Math.floor(i / 3) * 4 + i % 3]);
    }
    const result = new THREE.BufferAttribute(data, a.type === 'VEC4' ? 3 : size);
    arrays.set(index, result);
    return result;
  }
  const parts = json.meshes[0].primitives.map(p => {
    const geometry = new THREE.BufferGeometry();
    for (const [name, gltf] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['color', 'COLOR_0']])
      geometry.setAttribute(name, attribute(p.attributes[gltf]));
    geometry.setIndex(attribute(p.indices));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return { geometry, glow: p.material === 1 };
  });
  return { parts, bounds: parts[0].geometry.boundingBox.clone() };
}

export async function loadCourtyardModels(low) {
  const tier = low ? 'low' : 'high';
  const entries = await Promise.all(['bridge', 'cushion', 'lantern'].map(async name => {
    const file = name + '-' + tier + '.glb';
    const response = await fetch(globalThis.ISLE_MODELS?.[file] ?? sources[file]);
    if (!response.ok) throw new Error('Could not load garden model: ' + name);
    return [name, parseGardenModel(await response.arrayBuffer())];
  }));
  return Object.fromEntries(entries);
}
