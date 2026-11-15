import * as THREE from '../vendor/three.module.js';

// Both roofs retain their original footprint, ridge direction and quartic
// corner lift. All tiling is clipped to the four original roof patches.
export function buildRoof({
  cx,
  cz,
  w,
  d,
  eave,
  rise,
  low,
  add,
  box,
  beam,
  tube,
  materials
}) {
  const {
    slate,
    roofEdge,
    roofRib,
    timber,
    honey,
    dark
  } = materials;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const half = w / 2,
    depth = d / 2;
  const hip = Math.max(.15, half - depth * .75),
    small = w < 2.2;
  const tilePitch = small ? .158 : .176,
    tileWall = small ? .007 : .009;
  const buffers = new Map();
  let pans = 0,
    covers = 0,
    triangles = 0;
  const noise = (i, j, face) => {
    const x = Math.sin(i * 127.1 + j * 311.7 + face * 74.7 + (small ? 19 : 0)) * 43758.5453;
    return x - Math.floor(x);
  };
  const tileMaterial = (i, j, face) => {
    const n = noise(i, j, face);
    return slate[n < .08 ? 5 : n < .23 ? 3 : n < .47 ? 0 : n < .69 ? 1 : n < .90 ? 4 : 2];
  };
  const span = (t, face) => face < 2 ? half * (1 - t) + hip * t : depth * (1 - t);
  const limit = (u, face) => Math.min(1, Math.max(0,
    face < 2 ? (half - Math.abs(u)) / (half - hip) : 1 - Math.abs(u) / depth));

  function surface(s, t, face) {
    const q = 1 - t,
      lift = .17 * q * q * Math.abs(s) ** 4;
    return face < 2 ?
      V(cx + s * (half * q + hip * t), eave + rise * t ** 1.42 + lift, cz + (face === 0 ? 1 : -1) * depth * q) :
      V(cx + (face === 2 ? 1 : -1) * (half * q + hip * t), eave + rise * t ** 1.42 + lift, cz + s * depth * q);
  }
  const at = (u, t, face) => surface(u / Math.max(.00001, span(t, face)), t, face);

  function heightAt(x, z) {
    const dx = x - cx,
      dz = z - cz;
    const qz = Math.abs(dz) / depth,
      qx = (Math.abs(dx) - hip) / (half - hip);
    const q = Math.max(qz, qx, .00001),
      t = Math.min(1, Math.max(0, 1 - q));
    return qz >= qx ? at(dx, t, dz >= 0 ? 0 : 1).y : at(dz, t, dx >= 0 ? 2 : 3).y;
  }

  function triangle(a, b, c, m, ns) {
    if (new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).lengthSq() < 1e-16) return;
    if (!buffers.has(m)) buffers.set(m, {
      p: [],
      n: [],
      uv: []
    });
    const out = buffers.get(m);
    if (ns && b.clone().sub(a).cross(c.clone().sub(a)).dot(ns[0]) < 0) {
      [b, c] = [c, b];
      ns = [ns[0], ns[2], ns[1]];
    }
    const flat = ns ? null : b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    for (const [i, p] of [a, b, c].entries()) {
      out.p.push(p.x, p.y, p.z);
      const n = ns ? ns[i] : flat;
      out.n.push(n.x, n.y, n.z);
      out.uv.push(p.x * .7, p.z * .7);
    }
    triangles++;
  }

  function quad(a, b, c, d, m, desired) {
    const ns = desired ? [desired, desired, desired] : undefined;
    triangle(a, b, c, m, ns);
    triangle(a, c, d, m, ns);
  }

  function clip(poly, distance) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        da = distance(a),
        db = distance(b);
      if (da >= -1e-9) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const f = da / (da - db);
        out.push({
          u: a.u + (b.u - a.u) * f,
          t: a.t + (b.t - a.t) * f
        });
      }
    }
    return out;
  }

  function trim(poly, face) {
    poly = clip(poly, p => span(p.t, face) - .010 - p.u);
    poly = clip(poly, p => span(p.t, face) - .010 + p.u);
    return clip(poly, p => .996 - p.t);
  }
  // Closed curved shells include their underside and the exposed lapped ends.
  // Broad flat pans and narrow half-round covers use the same shared batches.
  function tile(face, center, radius, t0, t1, profile, thickness, material) {
    const u0 = center - radius,
      u1 = center + radius;
    const rectangle = (left, right) => [{
      u: left,
      t: t0
    }, {
      u: right,
      t: t0
    }, {
      u: right,
      t: t1
    }, {
      u: left,
      t: t1
    }];
    const outline = trim(rectangle(u0, u1), face);
    if (outline.length < 3) return false;
    const lift = t => .011 * Math.max(0, 1 - (t - t0) / (t1 - t0));
    const pos = (u, t, inner = false) => {
      const p = at(u, t, face);
      p.y += profile((u - center) / radius) + lift(t) - (inner ? thickness : 0);
      return p;
    };
    const normal = (u, t, inner) => {
      const a = pos(u + .0002, t).sub(pos(u - .0002, t));
      const b = pos(u, Math.min(.9999, t + .00015)).sub(pos(u, Math.max(0, t - .00015)));
      const n = a.cross(b).normalize();
      if (n.y < 0) n.negate();
      return inner ? n.negate() : n;
    };
    const samples = thickness === tileWall ? [-1, 0, 1] :
      low ? [-1, -.7071, 0, .7071, 1] : [-1, -.866, -.5, 0, .5, .866, 1];
    for (let k = 0; k < samples.length - 1; k++) {
      const poly = trim(rectangle(center + radius * samples[k], center + radius * samples[k + 1]), face);
      for (const inner of [false, true]) {
        for (let i = 1; i < poly.length - 1; i++) {
          const verts = [poly[0], poly[i], poly[i + 1]];
          triangle(...verts.map(p => pos(p.u, p.t, inner)), material, verts.map(p => normal(p.u, p.t, inner)));
        }
      }
    }
    const middle = pos((u0 + u1) / 2, (t0 + t1) / 2);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length];
      const cuts = [0, 1];
      if (Math.abs(b.u - a.u) > 1e-8)
        for (const s of samples.slice(1, -1)) {
          const f = (center + radius * s - a.u) / (b.u - a.u);
          if (f > .00001 && f < .99999) cuts.push(f);
        }
      cuts.sort((a, b) => a - b);
      for (let j = 1; j < cuts.length; j++) {
        const point = f => ({
          u: a.u + (b.u - a.u) * f,
          t: a.t + (b.t - a.t) * f
        });
        const p = point(cuts[j - 1]),
          q = point(cuts[j]);
        const pa = pos(p.u, p.t),
          pb = pos(q.u, q.t),
          pc = pos(q.u, q.t, true),
          pd = pos(p.u, p.t, true);
        quad(pa, pb, pc, pd, material, pa.clone().lerp(pb, .5).sub(middle).normalize());
      }
    }
    return true;
  }
  // A shallow timber deck and a curved solid fascia establish a real eave edge.
  for (let face = 0; face < 4; face++) {
    const count = Math.ceil((face < 2 ? w : d) / tilePitch);
    const pitch = (face < 2 ? w : d) / count;
    const length = Math.hypot(face < 2 ? depth : half - hip, rise);
    const rows = Math.ceil(length / (small ? .225 : .245));
    for (let i = 0; i < count; i++) {
      const u = (i + .5 - count / 2) * pitch;
      for (let j = 0; j < rows; j++) {
        const t0 = j / rows,
          t1 = Math.min(.996, (j + 1.16) / rows);
        if (t0 >= limit(u - Math.sign(u) * pitch * .48, face)) continue;
        if (tile(face, u, pitch * .501, t0, t1, s => -.013 * (1 - s * s) - .001,
            tileWall, tileMaterial(i, j, face))) pans++;
      }
    }
    for (let i = 1; i < count; i++) {
      const u = (i - count / 2) * pitch;
      for (let j = 0; j < rows; j++) {
        const t0 = j / rows,
          t1 = Math.min(.996, (j + 1.13) / rows);
        if (t0 >= limit(u - Math.sign(u) * .040, face)) continue;
        if (tile(face, u, small ? .035 : .040, t0, t1,
            s => (small ? .034 : .039) * Math.sqrt(Math.max(0, 1 - s * s)),
            tileWall + .0001, tileMaterial(i + 51, j + 2, face))) covers++;
      }
      // Low polygon end tiles have a small circular relief, not a full cylinder ridge.
      const p = at(u, 0, face);
      p.y += .012;
      const outward = face === 0 ? V(0, 0, 1) : face === 1 ? V(0, 0, -1) : face === 2 ? V(1, 0, 0) : V(-1, 0, 0);
      const r = small ? .029 : .034;
      tube(p.clone().addScaledVector(outward, -.010), p, r, r, tileMaterial(i, 0, face), 8);
      tube(p.clone().addScaledVector(outward, -.001), p.clone().addScaledVector(outward, .001), r * .39, r * .39, roofRib, 6);
    }
    // The underside follows the same four patches and corner curve.
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 6; j++) {
        const s0 = -1 + i / 6,
          s1 = -1 + (i + 1) / 6,
          t0 = j / 6,
          t1 = Math.min(.9999, (j + 1) / 6);
        const q = [surface(s0, t0, face), surface(s1, t0, face), surface(s1, t1, face), surface(s0, t1, face)];
        for (const p of q) p.y -= .030;
        quad(...q, dark, V(0, -1, 0));
      }
    const edgeCount = Math.max(16, count);
    const outward = face === 0 ? V(0, 0, 1) : face === 1 ? V(0, 0, -1) : face === 2 ? V(1, 0, 0) : V(-1, 0, 0);
    for (let i = 0; i < edgeCount; i++) {
      const s0 = -1 + i * 2 / edgeCount,
        s1 = -1 + (i + 1) * 2 / edgeCount;
      const a = surface(s0, 0, face),
        b = surface(s1, 0, face);
      const ia = surface(s0, .033, face),
        ib = surface(s1, .033, face);
      ia.y = a.y;
      ib.y = b.y;
      const top = small ? .021 : .024,
        bottom = small ? .086 : .095;
      const drop = (p, y) => p.clone().add(V(0, -y, 0));
      quad(drop(a, top), drop(b, top), drop(b, bottom), drop(a, bottom), honey, outward);
      quad(drop(a, bottom), drop(b, bottom), drop(ib, bottom), drop(ia, bottom), dark, V(0, -1, 0));
      quad(drop(ia, top), drop(ib, top), drop(b, top), drop(a, top), timber, V(0, 1, 0));
      quad(drop(ia, bottom), drop(ib, bottom), drop(ib, top), drop(ia, top), timber, outward.clone().negate());
      // A narrow gray drip course rests over the wooden fascia.
      quad(drop(a, .005), drop(b, .005), drop(b, .026), drop(a, .026), roofEdge, outward);
    }
  }
  const crest = [
    [-1, 0],
    [-1, .16],
    [-.72, .30],
    [-.61, .62],
    [-.32, .94],
    [0, 1],
    [.32, .94],
    [.61, .62],
    [.72, .30],
    [1, .16],
    [1, 0]
  ];
  const cap = [
    [-1, 0],
    [-1, .13],
    [-.707, .72],
    [0, 1],
    [.707, .72],
    [1, .13],
    [1, 0]
  ];

  function sweep(points, widths, heights, profile, material) {
    const rings = points.map((p, i) => {
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)];
      const across = V(-(b.z - a.z), 0, b.x - a.x).normalize();
      return profile.map(([u, v]) => p.clone().addScaledVector(across, u * widths[i]).add(V(0, v * heights[i], 0)));
    });
    for (let i = 1; i < rings.length; i++)
      for (let j = 0; j < profile.length; j++) {
        const k = (j + 1) % profile.length;
        quad(rings[i - 1][k], rings[i][k], rings[i][j], rings[i - 1][j], material);
      }
    for (const i of [0, rings.length - 1])
      for (let j = 1; j < profile.length - 1; j++)
        if (i === 0) triangle(rings[i][0], rings[i][j + 1], rings[i][j], material);
        else triangle(rings[i][0], rings[i][j], rings[i][j + 1], material);
  }
  // Four covered hips meet the same ridge endpoints. Their lapped cap units
  // follow the curve and cover the cut ends of the pan and cover tiles.
  for (const sign of [-1, 1])
    for (const face of [0, 1]) {
      const point = t => surface(sign, t, face);
      const bed = Array.from({
        length: 13
      }, (_, i) => point(i / 12).add(V(0, .006, 0)));
      sweep(bed, bed.map(() => small ? .0526 : .060), bed.map(() => .020), cap, roofEdge);
      const n = small ? 8 : 10;
      for (let j = 0; j < n; j++) {
        const t0 = j / n,
          t1 = Math.min(1, (j + 1.08) / n);
        const points = [t0, (t0 + t1) / 2, t1].map((t, i) => point(t).add(V(0, .023 + (i === 0 ? .005 : 0), 0)));
        sweep(points, points.map(() => small ? .047 : .057), points.map(() => small ? .042 : .049),
          cap, tileMaterial(j + 11, sign + 3, face));
      }
      // The corner rafter is seated below the curved hip instead of floating.
      for (let i = 0; i < 5; i++) {
        const a = point(.025 + i * .075),
          b = point(.025 + (i + 1) * .075);
        a.y -= .075;
        b.y -= .075;
        beam(a, b, .053, .060, timber);
      }
    }
  // A stepped ridge bed, cambered ridge tiles and tapered rising end caps.
  const ridgePts = Array.from({
    length: 9
  }, (_, i) => {
    const s = -1 + i / 4;
    return V(cx + s * hip, eave + rise + .005 + .014 * s ** 4, cz);
  });
  sweep(ridgePts, ridgePts.map(() => small ? .071 : .087), ridgePts.map(() => small ? .073 : .088), crest, roofEdge);
  const ridgePieces = Math.max(2, Math.ceil(2 * hip / .24));
  for (let j = 0; j < ridgePieces; j++) {
    const a = -hip + j * 2 * hip / ridgePieces,
      b = Math.min(hip, -hip + (j + 1.08) * 2 * hip / ridgePieces);
    const pts = [a, (a + b) / 2, b].map((x, i) => V(cx + x, eave + rise + .061 + .014 * (x / hip) ** 4 + (i === 0 ? .004 : 0), cz));
    sweep(pts, pts.map(() => small ? .054 : .066), pts.map(() => small ? .043 : .052), cap, tileMaterial(j, 31, 0));
  }
  for (const sign of [-1, 1]) {
    const pts = [
      [-.045, .010],
      [.032, .033],
      [.113, .108],
      [.18, .170]
    ].map(([x, y]) => V(cx + sign * (hip + x), eave + rise + y, cz));
    sweep(pts, small ? [.068, .058, .041, .028] : [.084, .071, .045, .028],
      small ? [.092, .087, .052, .0226990191] : [.112, .103, .056, .0226990191], crest, roofRib);
  }
  // Slender exposed rafters stop on the wall purlins. The attached study roof
  // keeps fewer bracket sets and a thinner fascia than the main roof.
  const xs = small ? [-2.15, -.84] : [-.83, 2.20];
  const zs = small ? [-1.35, 1.28] : [-1.27, 1.02];
  const beamTop = small ? 1.825 : 3.64;
  for (let face = 0; face < 4; face++) {
    if (small && face === 2) continue;
    const width = face < 2 ? w : d,
      n = Math.ceil(width / (small ? .26 : .30));
    const wallT = face < 2 ? 1 - Math.abs(zs[face === 0 ? 1 : 0] - cz) / depth :
      1 - (Math.abs(xs[face === 2 ? 1 : 0] - cx) - hip) / (half - hip);
    for (let i = 1; i < n; i++) {
      const u = (i / n - .5) * width,
        end = Math.min(wallT + .06, limit(u, face) - .025, .71);
      if (end <= .045) continue;
      for (let k = 0; k < 4; k++) {
        const a = at(u, .012 + (end - .012) * k / 4, face);
        const b = at(u, .012 + (end - .012) * (k + 1) / 4, face);
        a.y -= .052 + .045 * (1 - k / 4) ** 2;
        b.y -= .052 + .045 * (1 - (k + 1) / 4) ** 2;
        beam(a, b, small ? .032 : .039, small ? .035 : .044, timber);
      }
    }
  }
  // Purlins follow the roof's underside and sit on compact cross-block brackets.
  for (const z of zs)
    for (let i = 0; i < 12; i++) {
      const a = xs[0] + (xs[1] - xs[0]) * i / 12,
        b = xs[0] + (xs[1] - xs[0]) * (i + 1) / 12;
      const ya = heightAt(a, z) - .107;
      const yb = heightAt(b, z) - .107;
      beam(V(a, ya, z), V(b, yb, z), small ? .048 : .064, small ? .063 : .079, timber);
    }
  const armWidth = small ? .26 : .33,
    armDepth = small ? .063 : .075;
  const arm = new THREE.Shape();
  const contour = [
    [-.5, .030],
    [.5, .030],
    [.5, .008],
    [.27, .001],
    [.14, -.016],
    [-.14, -.016],
    [-.27, .001],
    [-.5, .008]
  ];
  contour.forEach(([x, y], i) => i ? arm.lineTo(x * armWidth, y) : arm.moveTo(x * armWidth, y));
  arm.closePath();
  const bracketArm = new THREE.ExtrudeGeometry(arm, {
    depth: armDepth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1
  });
  bracketArm.translate(0, 0, -armDepth / 2);
  const crossArm = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2);
  for (const x of xs)
    for (const z of zs) {
      if (small && x === xs[1]) continue;
      const top = Math.max(beamTop, heightAt(x, z) - .137),
        h = Math.max(.026, top - beamTop);
      for (let k = 0; k < 3; k++) {
        const y = beamTop + (k + .5) * h / 3;
        box(x, y, z, .13 + k * .055, h / 3 + .002, .12 + k * .055, k === 1 ? honey : timber);
      }
      add(bracketArm, honey, x, top, z);
      add(bracketArm, timber, x, top + .012, z, 1, 1, 1, crossArm);
    }
  // Two modest roof frames carry the upper purlins and ridge from the wall beams.
  for (const x of (small ? [cx] : [cx - .49, cx + .49])) {
    for (const z of zs)
      for (let k = 0; k < 8; k++) {
        const za = z + (cz - z) * k / 8,
          zb = z + (cz - z) * (k + 1) / 8;
        beam(V(x, heightAt(x, za) - .058, za), V(x, heightAt(x, zb) - .058, zb),
          small ? .043 : .054, .055, dark);
      }
  }
  for (const [material, data] of buffers) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.p, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.n, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
    add(geometry, material);
  }
  return {
    surface,
    pans,
    covers,
    triangles,
    footprint: [w, d],
    top: eave + rise + .1926990191
  };
}
