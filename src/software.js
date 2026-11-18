// CPU fallback for browsers with WebGL disabled. It projects the same Three.js
// scene through the orbit camera and retains a z-buffer for animated objects.
import * as T from '../vendor/three.module.js';
import {
  rasterTriangle
} from './raster.js';
const textures = new WeakMap(),
  identity = new T.Matrix4(),
  normalMatrix = new T.Matrix3();
const mix = (a, b, t) => a + (b - a) * t,
  clamp = (n, l, h) => Math.max(l, Math.min(h, n));
const gamma = new Uint8Array(8193);
for (let i = 0; i < gamma.length; i++) {
  const x = i / 4096;
  gamma[i] = Math.min(255, Math.round(255 * (x < .0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - .055)))
}

function srgb(linear) {
  return gamma[clamp((linear * 4096) | 0, 0, 8192)]
}

// The same value noise the rock shader uses, so the CPU fallback scatters its
// moss in the same places as the GPU path.
function rockHash(x, y, z) {
  let px = (x * .3183099 + .71) % 1,
    py = (y * .3183099 + .113) % 1,
    pz = (z * .3183099 + .419) % 1;
  px = (px < 0 ? px + 1 : px) * 17;
  py = (py < 0 ? py + 1 : py) * 17;
  pz = (pz < 0 ? pz + 1 : pz) * 17;
  const v = (px * py * pz * (px + py + pz)) % 1;
  return v < 0 ? v + 1 : v;
}

function rockNoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const n000 = rockHash(ix, iy, iz),
    n100 = rockHash(ix + 1, iy, iz),
    n010 = rockHash(ix, iy + 1, iz),
    n110 = rockHash(ix + 1, iy + 1, iz),
    n001 = rockHash(ix, iy, iz + 1),
    n101 = rockHash(ix + 1, iy, iz + 1),
    n011 = rockHash(ix, iy + 1, iz + 1),
    n111 = rockHash(ix + 1, iy + 1, iz + 1);
  const lx0 = n000 + (n100 - n000) * fx,
    lx1 = n010 + (n110 - n010) * fx,
    lx2 = n001 + (n101 - n001) * fx,
    lx3 = n011 + (n111 - n011) * fx;
  const ly0 = lx0 + (lx1 - lx0) * fy,
    ly1 = lx2 + (lx3 - lx2) * fy;
  return ly0 + (ly1 - ly0) * fz;
}

// sRGB byte to linear float, matching the GPU's colour management.
const toLinear = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  toLinear[i] = c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
}

function mapFor(t) {
  if (!t) return null;
  if (textures.has(t)) return textures.get(t);
  const im = t.image,
    canvas = document.createElement('canvas');
  canvas.width = im.width;
  canvas.height = im.height;
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });
  ctx.drawImage(im, 0, 0);
  const map = {
    data: ctx.getImageData(0, 0, im.width, im.height).data,
    width: im.width,
    height: im.height,
    flipY: t.flipY,
    repeatX: t.repeat.x,
    repeatY: t.repeat.y,
    offsetX: t.offset.x,
    offsetY: t.offset.y,
    wrapS: t.wrapS === T.RepeatWrapping ? 'repeat' : 'clamp',
    wrapT: t.wrapT === T.RepeatWrapping ? 'repeat' : 'clamp'
  };
  map.levels = [];
  for (let level = 1; level <= 5; level++) {
    const scale = 2 ** level,
      w = Math.max(1, Math.round(im.width / scale)),
      h = Math.max(1, Math.round(im.height / scale));
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, 0, 0, w, h);
    map.levels.push({
      data: ctx.getImageData(0, 0, w, h).data,
      width: w,
      height: h
    });
  }
  // The rock maps are authored in sRGB but consumed as linear factors, so the
  // byte data is converted once here to match the GPU path.
  if (t.userData?.linearize) {
    const linearize = data => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = toLinear[data[i]] * 255;
        data[i + 1] = toLinear[data[i + 1]] * 255;
        data[i + 2] = toLinear[data[i + 2]] * 255;
      }
    };
    linearize(map.data);
    for (const level of map.levels) linearize(level.data);
    map.linear = true;
  }
  textures.set(t, map);
  return map;
}

function renderGeometry(frame, rec) {
  const a = rec.screen,
    idx = rec.geometry.index?.array,
    m = rec.paint;
  if (idx) {
    for (let j = 0; j < idx.length; j += 3) rasterTriangle(frame, a, idx[j], idx[j + 1], idx[j + 2], m)
  } else {
    for (let j = 0; j < rec.count; j += 3) rasterTriangle(frame, a, j, j + 1, j + 2, m)
  }
}

function setWorld(rec, instance) {
  const obj = rec.obj,
    mat = rec.matrix;
  if (instance >= 0) {
    obj.getMatrixAt(instance, identity);
    mat.multiplyMatrices(obj.matrixWorld, identity)
  } else mat.copy(obj.matrixWorld);
  const e = mat.elements,
    f = normalMatrix.getNormalMatrix(mat).elements,
    g = rec.geometry.attributes;
  const p = g.position.array,
    n = g.normal?.array,
    wp = rec.position,
    wn = rec.normal;
  for (let k = 0; k < p.length; k += 3) {
    const x = p[k],
      y = p[k + 1],
      z = p[k + 2];
    wp[k] = e[0] * x + e[4] * y + e[8] * z + e[12];
    wp[k + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    wp[k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    if (n) {
      let a = n[k],
        b = n[k + 1],
        c = n[k + 2];
      let nx = f[0] * a + f[3] * b + f[6] * c,
        ny = f[1] * a + f[4] * b + f[7] * c,
        nz = f[2] * a + f[5] * b + f[8] * c;
      const l = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
      wn[k] = nx * l;
      wn[k + 1] = ny * l;
      wn[k + 2] = nz * l;
    }
  }
}

function isDynamic(o) {
  return o.userData.softOnly || o.renderOrder > 0 || (o.isInstancedMesh && o.instanceMatrix.usage === T
    .DynamicDrawUsage) || (!o.isInstancedMesh && o.parent?.parent?.parent?.isGroup)
}

function record(obj, instance) {
  const geom = obj.geometry,
    g = geom.attributes,
    N = g.position.count,
    m = obj.material;
  const dyn = isDynamic(obj) || obj.userData.dynamic,
    rec = {
      obj,
      geometry: geom,
      count: N,
      instance,
      dyn,
      matrix: new T.Matrix4(),
      position: new Float32Array(N * 3),
      normal: new Float32Array(N * 3),
      screen: new Float32Array(8 * N),
      color: new T.Color(1, 1, 1),
      paint: {
        texture: mapFor(m.map),
        alphaTest: m.alphaTest || 0,
        depthWrite: m.depthWrite !== false,
        opacity: m.opacity ?? 1,
        // The rock material keeps its shading linear so the albedo map can be
        // multiplied in linear space, exactly like the GPU shader does.
        linearLight: !!m.userData?.rock
      }
    };
  if (obj.isInstancedMesh && obj.instanceColor) obj.getColorAt(instance, rec.color);

  // The rock shader paints the moss from the per instance growth value and the
  // per vertex crevice term; the CPU path reads the same two numbers.
  if (g.aRockData && instance >= 0) rec.rockGrowth = g.aRockData.array[instance * 4 + 3];
  if (g.aCavity) {
    rec.cavity = new Float32Array(N);
    for (let k = 0; k < N; k++) rec.cavity[k] = g.aCavity.getX(k);
  }
  if (g.uv)
    for (let k = 0; k < N; k++) {
      rec.screen[8 * k + 6] = g.uv.getX(k);
      rec.screen[8 * k + 7] = g.uv.getY(k)
    }
  setWorld(rec, instance);
  return rec;
}

function shadowCamera(sun) {
  const c = new T.OrthographicCamera(-9.5, 9.5, 9.5, -9.5, .1, 65);
  c.position.copy(sun.position).normalize().multiplyScalar(24).add(new T.Vector3(0, 1.8, 0));
  c.lookAt(0, 1.8, 0);
  c.updateMatrixWorld();
  return new T.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)
}
const shadowN = 480;

function castShadow(records, sun) {
  const matrix = shadowCamera(sun),
    e = matrix.elements,
    N = shadowN;
  const frame = {
    width: N,
    height: N,
    color: new Uint8ClampedArray(N * N * 4),
    depth: new Float32Array(N * N)
  };
  frame.depth.fill(Infinity);
  for (const r of records) {
    if (!r.obj.castShadow || r.dyn || r.obj.material.transparent || r.obj.isInstancedMesh) continue;
    project(r, e, N, N);
    renderGeometry(frame, r)
  }
  return {
    e,
    depth: frame.depth
  };
}

function project(r, e, w, h) {
  const p = r.position,
    s = r.screen;
  for (let i = 0, k = 0; i < p.length; i += 3, k += 8) {
    const x = p[i],
      y = p[i + 1],
      z = p[i + 2];
    s[k] = (e[0] * x + e[4] * y + e[8] * z + e[12] + 1) * w * .5;
    s[k + 1] = (1 - e[1] * x - e[5] * y - e[9] * z - e[13]) * h * .5;
    s[k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]
  }
}

function shade(r, lights, shadow) {
  const o = r.obj,
    m = o.material,
    isWater = m.isShaderMaterial,
    s = r.screen,
    wp = r.position,
    n = r.normal,
    color = r.geometry.attributes.color?.array;
  const base = isWater ? m.uniforms.tint.value : m.color || r.color;
  const br = base.r * r.color.r,
    bg = base.g * r.color.g,
    bb = base.b * r.color.b;
  const {
    dir,
    sun,
    sky,
    points
  } = lights, em = m.emissive || {
    r: 0,
    g: 0,
    b: 0
  }, ei = m.emissiveIntensity || 0;
  const blossoms = o.name === 'Layered cherry flower sprays',
    sh = shadow?.e,
    depth = shadow?.depth;
  r.paint.opacity = isWater ? .44 : m.opacity ?? 1;
  r.paint.depthWrite = isWater ? false : m.depthWrite !== false;
  for (let i = 0, k = 0; i < wp.length; i += 3, k += 8) {
    const x = wp[i],
      y = wp[i + 1],
      z = wp[i + 2],
      cr0 = br * (m.vertexColors && color ? color[i] : 1),
      cg0 = bg * (m.vertexColors && color ? color[i + 1] : 1),
      cb0 = bb * (m.vertexColors && color ? color[i + 2] : 1);
    if (m.isMeshBasicMaterial || isWater) {
      s[k + 3] = srgb(cr0);
      s[k + 4] = srgb(cg0);
      s[k + 5] = srgb(cb0);
      continue
    }
    const nx = n[i],
      ny = n[i + 1],
      nz = n[i + 2];
    // Moss grows on the upward faces of the stone, exactly as the GPU shader
    // paints it, so both paths show the same green caps.
    let cr = cr0, cg = cg0, cb = cb0;
    if (r.rockGrowth !== undefined) {
      const smooth = (a, b, v) => {
        const t = clamp((v - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
      };
      const up = smooth(.20, .84, ny);
      const cavity = r.cavity ? r.cavity[i / 3] : 0;
      const blotch = rockNoise(x * 1.45, y * 1.45, z * 1.45);
      const patch = rockNoise(x * 3.6 + 11, y * 3.6 + 11, z * 3.6 + 11);
      const clump = rockNoise(x * 8.4 + 57, y * 8.4 + 57, z * 8.4 + 57);
      const grain = rockNoise(x * 13, y * 13, z * 13);
      // The same three scale blend as the GPU shader decides where the growth
      // can take hold.
      const field = blotch * .34 + patch * .38 + clump * .28;
      const mask = smooth(.32, .74, field);
      let moss = clamp(up * mask * r.rockGrowth, 0, 1);
      // Seams and weathered crack lines carry growth regardless of slope.
      const crackN = rockNoise(x * 4.8 + 7, y * 4.8 + 7, z * 4.8 + 7);
      let crack = 1 - smooth(.02, .11, Math.abs(crackN - .5));
      crack *= crack;
      const crevice = clamp(cavity * .9 + crack * .5, 0, 1);
      moss = clamp(moss + crevice * smooth(.28, .68, patch * .5 + clump * .5) *
        r.rockGrowth * .85, 0, 1);
      // Damp streaks seeping down from the crown.
      const seep = smooth(.54, .82, rockNoise(x * 5.2 + 23, y * 1.7 + 23, z * 5.2 + 23)) *
        (1 - up) * smooth(.05, .40, ny + .30);
      moss = clamp(moss + seep * mask * r.rockGrowth * .6, 0, 1);
      moss = smooth(.24, .66, moss + (grain - .5) * .52);
      // The CPU path applies the albedo map after the shading, so the growth
      // is pre-divided by the mean of that map to land on the same grey green.
      const toneMix = smooth(.15, .70, up);
      const tone = (.62 + .38 * (1 - cavity)) * 1.787 *
        (.78 + .38 * rockNoise(x * 4.4 + 31, y * 4.4 + 31, z * 4.4 + 31)) *
        (.92 + .18 * grain);
      const fringe = smooth(.30, .72, moss);
      const mr = (.132 + (.250 - .132) * toneMix) * (1 - fringe) + .382 * fringe;
      const mg = (.186 + (.345 - .186) * toneMix) * (1 - fringe) + .434 * fringe;
      const mb = (.160 + (.205 - .160) * toneMix) * (1 - fringe) + .320 * fringe;
      cr = cr0 * (1 - moss) + mr * moss * tone;
      cg = cg0 * (1 - moss) + mg * moss * tone;
      cb = cb0 * (1 - moss) + mb * moss * tone;
      // Wet foot below the tide line, matching the GPU shader's darkening.
      const wet = 1 - smooth(.06, .30, y + (rockNoise(x * 6.5, y * 6.5, z * 6.5) - .5) * .14);
      cr *= 1 - .535 * wet;
      cg *= 1 - .498 * wet;
      cb *= 1 - .487 * wet;
    }
    let nd = nx * dir.x + ny * dir.y + nz * dir.z;
    if (blossoms) nd = clamp(.39 + .30 * Math.abs(nd) + .22 * (y - 4), .16, 1);
    let lit = 1;
    if (sh && nd > 0) {
      const u = ((sh[0] * x + sh[4] * y + sh[8] * z + sh[12] + 1) * shadowN * .5) | 0,
        v = ((1 - sh[1] * x - sh[5] * y - sh[9] * z - sh[13]) * shadowN * .5) | 0;
      if (u > 0 && u < shadowN - 2 && v > 0 && v < shadowN - 2) {
        const dz = sh[2] * x + sh[6] * y + sh[10] * z + sh[14] - .0028;
        const f = v * shadowN + u;
        lit = 1 - .205 * ((dz > depth[f]) + (dz > depth[f + 1]) + (dz > depth[f + shadowN]) + (dz > depth[f +
          shadowN + 1]));
      }
    }
    const direct = Math.max(0, nd) * sun.intensity * .40 * lit;
    const hem = blossoms ? .77 : clamp(ny * .44 + .52, .03, 1);
    const room = false;
    const ambient = sky.intensity * (room ? .23 : .405);
    let lr = ambient * mix(sky.groundColor.r, sky.color.r, hem) + direct * sun.color.r;
    let lg = ambient * mix(sky.groundColor.g, sky.color.g, hem) + direct * sun.color.g;
    let lb = ambient * mix(sky.groundColor.b, sky.color.b, hem) + direct * sun.color.b;
    for (let j = 0; j < points.length; j++) {
      const p = points[j];
      if (p.intensity < .05) continue;
      const dx = p.position.x - x,
        dy = p.position.y - y,
        dz = p.position.z - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d > p.distance * p.distance) continue;
      const light = p.intensity * .35 / (1 + d) * Math.max(.14, (dx * nx + dy * ny + dz * nz) / Math.sqrt(d +
        .001)) * (1 - d / (p.distance * p.distance));
      lr += p.color.r * light;
      lg += p.color.g * light;
      lb += p.color.b * light;
    }
    if (r.paint.linearLight) {
      // The rock path keeps the lit colour linear so the albedo map can be
      // multiplied in linear space, exactly like the GPU shader does.
      s[k + 3] = cr * lr + em.r * ei * .72;
      s[k + 4] = cg * lg + em.g * ei * .72;
      s[k + 5] = cb * lb + em.b * ei * .72;
    } else {
      s[k + 3] = srgb(cr * lr + em.r * ei * .72);
      s[k + 4] = srgb(cg * lg + em.g * ei * .72);
      s[k + 5] = srgb(cb * lb + em.b * ei * .72);
    }
  }
}
// Sample the same directional shadow map on the display surface beneath the
// square model. Only the area near the base receives these diluted shadows.
function floorShadow(frame, projection, shadow, sun) {
  const w = frame.width,
    h = frame.height,
    y = -.04;
  const e = projection,
    sh = shadow.e,
    depth = shadow.depth,
    N = shadowN;
  const ax = e[0] * w * .5,
    az = e[8] * w * .5,
    bx = -e[1] * h * .5,
    bz = -e[9] * h * .5;
  const ox = (1 + e[4] * y + e[12]) * w * .5,
    oy = (1 - e[5] * y - e[13]) * h * .5;
  const inv = 1 / (ax * bz - bx * az);
  if (!Number.isFinite(inv)) return;
  const offsets = [-2 * N - 2, -2 * N + 2, 2 * N - 2, 2 * N + 2],
    strength = .12 + .04 * Math.max(0, 1 - sun.position.y / 15);
  const c = frame.color;
  for (let j = 0; j < h; j += 2) {
    let x = (-ox * bz - (j - oy) * az) * inv,
      z = (ax * (j - oy) + bx * ox) * inv;
    for (let i = 0; i < w; i += 2, x += 2 * bz * inv, z -= 2 * bx * inv) {
      const outside = Math.max(Math.abs(x) - 5.1, Math.abs(z) - 5.1);
      if (outside < -.1 || outside > 4) continue;
      const u = ((sh[0] * x + sh[4] * y + sh[8] * z + sh[12] + 1) * N * .5) | 0,
        v = ((1 - sh[1] * x - sh[5] * y - sh[9] * z - sh[13]) * N * .5) | 0;
      if (u < 3 || u > N - 4 || v < 3 || v > N - 4) continue;
      const dz = sh[2] * x + sh[6] * y + sh[10] * z + sh[14] - .003,
        f = v * N + u;
      let penumbra = 0;
      for (const off of offsets)
        if (dz > depth[f + off]) penumbra += .25;
      if (!penumbra) continue;
      const alpha = 255 * strength * (1 - Math.max(0, outside) / 4) ** 1.9 * penumbra;
      for (let yy = j; yy < Math.min(j + 2, h); yy++)
        for (let xx = i; xx < Math.min(i + 2, w); xx++) {
          const k = (yy * w + xx) * 4;
          c[k] = 79;
          c[k + 1] = 69;
          c[k + 2] = 92;
          c[k + 3] = alpha;
        }
    }
  }
}
export class SoftRenderer {
  constructor() {
    this.domElement = document.createElement('canvas');
    this.context = this.domElement.getContext('2d', {
      alpha: true
    });
    this.shadowMap = {};
    this.pixelRatio = 1;
    this.isSoftware = true;
    this.proj = new T.Matrix4();
    this.cachedKey = '';
    this.lastFrame = 0
  }
  setClearColor() {}
  setPixelRatio(v) {
    this.pixelRatio = v
  }
  setSize(w, h) {
    let d = this.interacting ? .6 : Math.min(this.pixelRatio, Math.sqrt(1150000 / (w * h)), 1.25);
    this.w = this.domElement.width = Math.round(w * d);
    this.h = this.domElement.height = Math.round(h * d);
    this.image = this.context.createImageData(this.w, this.h);
    this.frame = {
      width: this.w,
      height: this.h,
      color: this.image.data,
      depth: new Float32Array(this.w * this.h)
    };
    this.bg = new Uint8ClampedArray(this.frame.color.length);
    this.zbg = new Float32Array(this.frame.depth.length);
    this.cachedKey = '';
    this.mirrorKey = '';
  }
  init(scene) {
    this.records = [];
    this.lines = [];
    this.points = [];
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (o.isDirectionalLight) this.sun = o;
      if (o.isHemisphereLight) this.sky = o;
      if (o.isPointLight) this.points.push(o);
      if (o.isLine) this.lines.push(o);
      if (!o.isMesh || o.material.isShadowMaterial || !o.material.visible || o.material.colorWrite ===
        false || o.material.isShaderMaterial) return;
      for (let i = 0; i < (o.isInstancedMesh ? o.count : 1); i++) this.records.push(record(o, o
        .isInstancedMesh ? i : -1))
    });
    this.static = [];
    this.motion = [];
    this.overlay = [];
    for (const r of this.records) {
      const o = r.obj;
      if (o.material.isShaderMaterial || o.renderOrder >= 3) this.overlay.push(r);
      else(r.dyn ? this.motion : this.static).push(r)
    }
    this.emissiveMaterials = [...new Set(this.records.map(r => r.obj.material).filter(m => m.emissive
      ?.getHex()))];
    this.overlay.sort((a, b) => a.obj.renderOrder - b.obj.renderOrder);
    this.points.forEach(p => {
      if (!p.distance) p.distance = 6
    });
  }
  updateMirror(matrix, lights, key) {
    const stamp = performance.now();
    if (this.mirrorKey === key && stamp - (this.mirrorTime || 0) < 1200) return;
    if (stamp - (this.mirrorTime || 0) < 140) return;
    const w = Math.max(1, Math.round(this.w * .46)),
      h = Math.max(1, Math.round(this.h * .46));
    if (!this.reflection || this.reflection.width !== w || this.reflection.height !== h) {
      this.reflection = document.createElement('canvas');
      this.reflection.width = w;
      this.reflection.height = h;
      this.reflectionContext = this.reflection.getContext('2d');
      this.reflectionImage = this.reflectionContext.createImageData(w, h);
      this.reflectionFrame = {
        width: w,
        height: h,
        color: this.reflectionImage.data,
        depth: new Float32Array(w * h)
      };
    }
    const frame = this.reflectionFrame;
    frame.color.fill(0);
    frame.depth.fill(Infinity);
    const mirror = matrix.clone().multiply(new T.Matrix4().makeScale(1, -1, 1)).elements;
    for (const r of this.records) {
      if (!r.obj.visible || r.obj.material.opacity === 0) continue;
      let visible = true;
      for (let p = r.obj.parent; p; p = p.parent)
        if (!p.visible) visible = false;
      if (!visible) continue;
      if (r.dyn) setWorld(r, r.instance);
      project(r, mirror, w, h);
      shade(r, lights, null);
      renderGeometry(frame, r);
    }
    this.reflectionContext.putImageData(this.reflectionImage, 0, 0);
    this.mirrorKey = key;
    this.mirrorTime = stamp;
  }
  render(scene, camera) {
    const now = performance.now();
    if (now - this.lastFrame < 32) return;
    this.lastFrame = now;
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    if (!this.records) this.init(scene);
    const mat = this.proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      e = mat.elements,
      dir = this.sun.position.clone().normalize();
    const lightingKey = this.points.map(p => Math.round(p.intensity * 20)).join(',') + '/' + this
      .emissiveMaterials.map(m => Math.round(m.emissiveIntensity * 30)).join(',');
    const key = lightingKey + '/' + e.map(n => Math.round(n * 100000)).join(',') + '/' + this.sun.position
      .toArray().map(n => Math.round(n * 50)).join(',');
    const shadowKey = dir.toArray().map(n => Math.round(n * 17)).join(',');
    if (this.shadowKey !== shadowKey) {
      this.shadow = castShadow(this.records, this.sun);
      this.shadowKey = shadowKey
    }
    const lights = {
        dir,
        sun: this.sun,
        sky: this.sky,
        points: this.points
      },
      f = this.frame;
    this.updateMirror(mat, lights, key);
    const lightKey = lightingKey + '/' + this.sun.position.toArray().map(n => Math.round(n * 80)).join(',');
    const draw = (r, dynamic) => {
      if (!r.obj.visible && !r.obj.userData.softOnly) return;
      for (let parent = r.obj.parent; parent; parent = parent.parent)
        if (!parent.visible) return;
      if (dynamic) setWorld(r, r.instance);
      project(r, e, this.w, this.h);
      if (dynamic || r.lightKey !== lightKey) {
        shade(r, lights, this.shadow);
        r.lightKey = lightKey
      }
      renderGeometry(f, r)
    };
    if (key !== this.cachedKey) {
      f.color.fill(0);
      f.depth.fill(Infinity);
      for (const r of this.static) draw(r, false);
      this.bg.set(f.color);
      this.zbg.set(f.depth);
      this.cachedKey = key
    } else {
      f.color.set(this.bg);
      f.depth.set(this.zbg)
    }
    for (const r of this.motion) draw(r, true);
    for (const r of this.overlay) draw(r, r.dyn);
    this.context.putImageData(this.image, 0, 0);
    if (this.reflection) {
      const c = this.context;
      c.save();
      c.globalCompositeOperation = 'destination-over';
      for (let y = 0; y < this.reflection.height; y += 3) {
        c.globalAlpha = .18 * Math.max(.05, 1 - Math.max(0, y / this.reflection.height - .62) * 3.4);
        const dx = (Math.sin(y * .35 + now * .0005) + Math.sin(y * .13 - now * .0003) * .5) * 1.3;
        c.drawImage(this.reflection, 0, y, this.reflection.width, 3, dx, y * this.h / this.reflection
          .height, this.w, 3 * this.h / this.reflection.height + .7);
      }
      c.restore();
    }
    const ctx = this.context,
      v = new T.Vector3();
    for (const line of this.lines) {
      if (!line.visible) continue;
      const pos = line.geometry.attributes.position;
      ctx.beginPath();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(line.matrixWorld).applyMatrix4(mat);
        const x = (v.x + 1) * this.w * .5,
          y = (1 - v.y) * this.h * .5;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(255,249,229,.35)';
      ctx.lineWidth = .75;
      ctx.stroke()
    }
  }
}
