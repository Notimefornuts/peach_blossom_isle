import * as THREE from '../vendor/three.module.js';

// The offline build supplies the same two images as data URLs.
const sources = globalThis.ISLE_TEXTURES ?? {
  color: new URL('../assets/textures/shore-rock-color.webp', import.meta.url).href,
  normal: new URL('../assets/textures/shore-rock-normal.webp', import.meta.url).href
};

export async function loadShoreMaterial(low) {
  const loader = new THREE.TextureLoader();
  try {
    const [color, normal] = await Promise.all([
      loader.loadAsync(sources.color),
      low ? Promise.resolve(null) : loader.loadAsync(sources.normal)
    ]);
    color.colorSpace = THREE.SRGBColorSpace;
    for (const texture of [color, normal]) {
      if (!texture) continue;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    }
    return { color, normal };
  } catch (error) {
    // The island is still usable if a texture could not be loaded.
    console.warn('Shore material unavailable; using the original stones.', error);
    return null;
  }
}
