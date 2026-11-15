import * as THREE from '../vendor/three.module.js';

// Hand-painted flower sprays from a deterministic atlas. Each canopy is an open
// network of real branches carrying these double-sided sprays in different planes.
export function buildTree({
  scene,
  low,
  register
}) {
  let seed = 71027;

  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const range = (min, max) => min + random() * (max - min);
  const pick = list => list[Math.floor(random() * list.length)];
  const TAU = Math.PI * 2;
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const colour = c => new THREE.Color(c);
  const root = new THREE.Group();
  root.name = 'Sakura grove';
  scene.add(root);
  root.position.y = .85;

  function flowerAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d');

    function blossom(cx, cy, r, tilt, side) {
      c.save();
      c.translate(cx, cy);
      c.rotate(tilt);
      c.scale(1, side);
      const shade = pick(['#fdedf0', '#fce6eb', '#fff2ed', '#ffede8', '#f8dbe2']);
      for (let i = 0; i < 5; i++) {
        c.save();
        c.rotate(i * TAU / 5 + range(-.06, .06));
        const length = r * range(.85, 1.08);
        c.beginPath();
        c.moveTo(0, 2);
        c.bezierCurveTo(-.35 * r, -.09 * r, -.65 * r, -.72 * length, -.25 * r, -length);
        c.quadraticCurveTo(-.09 * r, -1.06 * length, 0, -.86 * length);
        c.quadraticCurveTo(.19 * r, -1.08 * length, .32 * r, -.90 * length);
        c.bezierCurveTo(.55 * r, -.62 * length, .23 * r, -.12 * r, 0, 2);
        c.fillStyle = shade;
        c.fill();
        c.strokeStyle = 'rgba(182,113,134,.37)';
        c.lineWidth = Math.max(.6, r * .034);
        c.stroke();
        c.beginPath();
        c.moveTo(-.06 * r, -.16 * r);
        c.quadraticCurveTo(-.16 * r, -.36 * r, -.18 * r, -.56 * r);
        c.moveTo(.03 * r, -.14 * r);
        c.quadraticCurveTo(.11 * r, -.4 * r, .2 * r, -.65 * r);
        c.strokeStyle = 'rgba(207,142,154,.51)';
        c.stroke();
        c.restore();
      }
      for (let i = 0; i < 10; i++) {
        const a = i * .61,
          extent = range(.17, .32) * r,
          x = Math.cos(a) * extent,
          y = Math.sin(a) * extent;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(x, y);
        c.strokeStyle = '#c78885';
        c.lineWidth = r * .035;
        c.stroke();
        c.beginPath();
        c.arc(x, y, r * .045, 0, TAU);
        c.fillStyle = '#e0ad72';
        c.fill();
      }
      c.restore();
    }
    // Watercolour underpainting groups the thin outer petals into larger
    // shapes at miniature scale. The few crisp flowers sit over the washes.
    function petalWash(x, y, r, tilt, fill) {
      c.save();
      c.translate(x, y);
      c.rotate(tilt);
      c.beginPath();
      c.moveTo(-.15 * r, .48 * r);
      c.bezierCurveTo(-.79 * r, .29 * r, -1.03 * r, -.35 * r, -.76 * r, -.73 * r);
      c.quadraticCurveTo(-.48 * r, -1.06 * r, -.18 * r, -.75 * r);
      c.quadraticCurveTo(.04 * r, -1.15 * r, .37 * r, -.89 * r);
      c.bezierCurveTo(.95 * r, -.69 * r, .68 * r, .06 * r, -.15 * r, .48 * r);
      c.fillStyle = fill;
      c.fill();
      c.restore();
    }
    const sprays = [
      [
        [75, 157, 31],
        [113, 174, 29],
        [111, 116, 37],
        [161, 133, 35],
        [160, 80, 26],
        [192, 109, 20]
      ],
      [
        [67, 161, 21],
        [100, 153, 34],
        [134, 118, 33],
        [174, 144, 26],
        [177, 83, 28],
        [197, 104, 19]
      ],
      [
        [73, 167, 25],
        [116, 144, 40],
        [141, 158, 28],
        [148, 95, 32],
        [185, 120, 27]
      ],
      [
        [70, 157, 28],
        [100, 109, 27],
        [121, 147, 37],
        [161, 111, 32],
        [184, 77, 22],
        [181, 157, 16]
      ]
    ];
    sprays.forEach((flowers, i) => {
      c.save();
      c.translate((i % 2) * 256, Math.floor(i / 2) * 256);
      c.strokeStyle = '#98757d';
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(22, 211);
      c.bezierCurveTo(90, 188, 127, 114, 207, 65);
      c.stroke();
      // Each lobe has a rose-violet shadow wash, uneven outer petals and a
      // lighter, broken upper surface. Real gaps remain between separate lobes.
      for (const [x, y, r] of flowers) {
        for (let j = 0; j < 10; j++) {
          const a = j * 2.39996 + range(-.25, .25),
            reach = r * range(.38, 1.08);
          const px = x + Math.cos(a) * reach,
            py = y + Math.sin(a) * reach;
          const tones = py > y ? ['#c6a8c0', '#d6adc0', '#d4abbb', '#dbb0bf'] : ['#e6bfcd', '#e9c0ce',
            '#f0d0d9', '#e4bdcc'
          ];
          petalWash(px, py, r * range(.43, .82), a + 1.4, pick(tones));
        }
      }
      for (const [x, y, r] of flowers) {
        for (let j = 0; j < 5; j++) {
          const a = range(0, TAU),
            reach = r * range(.48, 1.26);
          petalWash(x + Math.cos(a) * reach, y + Math.sin(a) * reach, r * range(.40, .74), a + 1.5, pick([
            '#f0c0c9', '#e5a4ba', '#f8c6cf', '#f3b8c6'
          ]));
        }
      }
      for (const [x, y, r] of flowers) {
        c.beginPath();
        c.moveTo(x - 18, y + 10);
        c.quadraticCurveTo(x - 12, y + 16, x, y);
        c.stroke();
        if (random() > .3) {
          c.save();
          c.translate(x + 6, y + 10);
          c.rotate(range(-1.6, .2));
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(5, -17, 14, -25);
          c.quadraticCurveTo(15, -7, 0, 0);
          c.fillStyle = pick(['#b79c88', '#a88883', '#aa9b8b']);
          c.fill();
          c.restore();
        }
        blossom(x, y, r * .92, range(-2, 2), range(.68, 1));
        blossom(x + r * .63, y - r * .45, r * range(.39, .58), range(-2, 2), range(.70, .92));
      }
      [
        [53, 177, 6],
        [55, 164, 7],
        [197, 63, 7],
        [210, 55, 6]
      ].forEach(([x, y, r]) => {
        c.beginPath();
        c.ellipse(x, y, r * .65, r, -.45, 0, TAU);
        c.fillStyle = '#d48a9b';
        c.fill();
      });
      c.restore();
    });
    const pixels = c.getImageData(0, 0, 512, 512);
    for (let j = 0; j < pixels.data.length; j += 4) {
      if (!pixels.data[j + 3]) continue;
      for (let k = 0; k < 3; k++) pixels.data[j + k] = Math.round(pixels.data[j + k] * .76 + [255, 244, 237][
        k] * .24);
    }
    c.putImageData(pixels, 0, 0);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  function batch() {
    return {
      p: [],
      n: [],
      c: [],
      uv: [],
      ix: []
    };
  }
  const branches = batch(),
    flowers = batch();

  function vert(batch, pos, normal, color) {
    batch.p.push(pos.x, pos.y, pos.z);
    batch.n.push(normal.x, normal.y, normal.z);
    batch.c.push(color.r, color.g, color.b);
  }

  function commit(b, mat, name, cast) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
    if (b.uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setIndex(b.ix);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  // Taper through bent rings to preserve a continuous bark silhouette at elbows.
  function limb(points, radii, sides, hue) {
    const base = branches.p.length / 3;
    let previous = v(1, 0, 0);
    let bands = Array.from({
      length: sides
    }, () => range(.74, 1.15));
    for (let j = 0; j < points.length; j++) {
      const tangent = points[Math.min(j + 1, points.length - 1)].clone().sub(points[Math.max(j - 1, 0)])
        .normalize();
      let right = previous.clone().addScaledVector(tangent, -previous.dot(tangent)).normalize();
      if (right.lengthSq() < .1) right = v(0, 0, 1);
      previous = right;
      const forward = tangent.clone().cross(right).normalize();
      for (let k = 0; k < sides; k++) {
        const a = k * TAU / sides,
          normal = right.clone().multiplyScalar(Math.cos(a)).addScaledVector(forward, Math.sin(a));
        const p = points[j].clone().addScaledVector(normal, radii[j] * (.9 + .11 * bands[k]));
        const co = colour(hue).multiplyScalar(bands[k] * range(.96, 1.04));
        vert(branches, p, normal, co);
        if (j > 0) {
          const lo = base + (j - 1) * sides + k,
            next = base + (j - 1) * sides + (k + 1) % sides;
          branches.ix.push(lo, next, lo + sides, next, next + sides, lo + sides);
        }
      }
    }
  }

  function sprig(p, size, normal, roll, tint, cell) {
    const right = v(0, 1, 0).cross(normal).normalize();
    if (right.lengthSq() < .1) right.set(1, 0, 0);
    const up = normal.clone().cross(right).normalize();
    const rx = right.clone().multiplyScalar(Math.cos(roll)).addScaledVector(up, Math.sin(roll));
    const ry = up.multiplyScalar(Math.cos(roll)).addScaledVector(right, -Math.sin(roll));
    const b = flowers.p.length / 3,
      u = (cell % 2) * .5,
      w = Math.floor(cell / 2) * .5;
    for (const [x, y] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
      ]) {
      const pt = p.clone().addScaledVector(rx, x * size * .5).addScaledVector(ry, y * size * .5);
      vert(flowers, pt, normal, tint);
      flowers.uv.push(u + (x + 1) * .25, w + (y + 1) * .25);
    }
    flowers.ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const ribbonAnchors = [];

  function sakura(cx, cz, scale, azimuth, back = false) {
    const loc = (x, y, z) => v(cx + x * scale * 1.35, y * scale * .90, cz + z * scale * 1.18);
    const bark = pick(['#70564f', '#735a55', '#785c56']);
    const trunk = [loc(0, 0, 0), loc(-.04, .24, .04), loc(.14, .87, .08), loc(-.03, 1.49, .05), loc(-.27,
      2.04, -.08), loc(-.12, 2.62, -.18), loc(.18, 3.04, -.18), loc(.28, 3.54, -.24)];
    limb(trunk, [.35, .26, .21, .186, .158, .12, .092, .064].map(x => x * scale), 11, bark);
    for (let i = 0; i < 7; i++) {
      const a = i * .90 + azimuth;
      limb([loc(Math.cos(a) * .67, .015, Math.sin(a) * .57), loc(Math.cos(a) * .27, .105, Math.sin(a) * .26),
        trunk[1]
      ], [.024, .094, .15].map(x => x * scale), 7, bark);
    }
    // Build a sequence of forked, upward sweeping boughs at unequal heights.
    // Upper boughs sit closer to the centre, so the crown rises in layers.
    for (let i = 0; i < (back ? 11 : 14); i++) {
      const high = i >= 9,
        a = azimuth + i * 2.39996 + range(-.22, .22);
      const dir = v(Math.cos(a), 0, Math.sin(a));
      const side = v(-dir.z, 0, dir.x);
      const source = trunk[high ? 6 : 2 + (i % 5)].clone();
      const reach = (high ? range(.58, 1.63) : range(1.45, 2.55)) * scale;
      const tier = (high ? range(4.95, 5.52) : range(3.52, 4.69)) * scale;
      const bend = range(-.64, .64) * scale;
      const a1 = source.clone().addScaledVector(dir, reach * .28).addScaledVector(side, bend * .25);
      const a2 = source.clone().addScaledVector(dir, reach * .60).addScaledVector(side, bend);
      const tip = source.clone().addScaledVector(dir, reach).addScaledVector(side, bend * .6);
      a1.y = source.y + (tier - source.y) * .42;
      a2.y = source.y + (tier - source.y) * .66;
      tip.y = tier;
      limb([source, a1, a2, tip], [high ? .08 : .123, .073, .043, .012].map(x => x * scale), 8, bark);
      for (let j = 0; j < 6; j++) {
        const f = j / 5,
          origin = a1.clone().lerp(a2, Math.min(1, f * 1.6));
        if (f > .64) origin.copy(a2).lerp(tip, (f - .64) / .36);
        const out = dir.clone().multiplyScalar(range(.16, .96)).addScaledVector(side, (j % 2 ? -1 : 1) *
          range(.38, 1.02)).normalize();
        const length = range(.45, .91) * scale;
        const mid = origin.clone().addScaledVector(out, length * .60);
        mid.y += range(.08, .23) * scale;
        const end = mid.clone().addScaledVector(out, length * .40);
        end.y += range(.14, .48) * scale;
        limb([origin, mid, end], [.036, .019, .006].map(x => x * scale), 6, bark);

        for (let k = 0; k < 4; k++) {
          const node = mid.clone().lerp(end, k / 4);
          const drift = out.clone().multiplyScalar(.38).addScaledVector(side, range(-1, 1)).normalize();
          const endTwig = node.clone().addScaledVector(drift, range(.22, .46) * scale);
          endTwig.y += range(.12, .35) * scale;
          limb([node, endTwig], [.012 * scale, .003 * scale], 4, '#8d7473');
          const count = low ? 4 : 7;
          for (let b = 0; b < count; b++) {
            const center = node.clone().lerp(endTwig, range(.04, 1.16));
            center.x += range(-.23, .23) * scale;
            center.y += range(-.12, .18) * scale;
            center.z += range(-.22, .22) * scale;
            const topness = (center.y - tier) / scale,
              a = range(0, TAU),
              y = range(.12, .94);
            const normal = v(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y));
            const t = topness > .02 ? pick(['#ffe5e5', '#ffd6df', '#f7d1db', '#fff0e7', '#f0c1d4']) : pick([
              '#ddaabe', '#dfb1c6', '#efbeca', '#cdaac4', '#efc4d3'
            ]);
            // Alternate broad, arching sprays with narrow sprays at their tips.
            // Fewer larger quads keep the inner mass coherent at default zoom.
            const large = b === 0 || b === 3 || b === 6;
            const flowerScale = (large ? range(.60, .84) : range(.35, .53)) * scale;
            const roll = range(0, TAU),
              cell = Math.floor(random() * 4);
            if (b % 4 !== 1) sprig(center, flowerScale, normal, roll, colour(t).lerp(colour(0xfff6fa), .74),
              cell);
          }
        }
      }
    }
  }
  sakura(-2.85, -1.40, 1.48, 1.2);
  const barkMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: .95,
    side: THREE.DoubleSide
  });
  commit(branches, barkMat, 'Tapered cherry boughs', true);
  const blossomMat = new THREE.MeshLambertMaterial({
    map: flowerAtlas(),
    vertexColors: true,
    side: THREE.DoubleSide,
    alphaTest: .39,
    emissive: 0x362532,
    emissiveIntensity: .16
  });
  // Keep normals directed into the sky on the reverse of each translucent flower.
  // This softens the cutout planes without an additive or fluorescent material.
  blossomMat.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nobjectNormal = normalize(mix(objectNormal, vec3(0.,1.,0.),.70));');
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\nif(!gl_FrontFacing) normal *= -1.;\n#endif');
  };
  commit(flowers, blossomMat, 'Layered cherry flower sprays', true);

  root.updateMatrixWorld(true);
  root.traverse(m => {
    if (m.isMesh) m.userData.dynamic = true;
  });
  const flowerMesh = root.children.find(m => m.name === 'Layered cherry flower sprays');
  const anchors = flowerMesh.geometry.attributes.position;
  register('tree', root, new THREE.Vector3(-3.5, 5.65, -.1));
  let shake = 0;
  return {
    root,
    act(id) {
      if (id === 'tree') shake = 1;
    },
    setTime(mode) {
      blossomMat.emissiveIntensity = [.16, .22, .36][mode];
    },
    blossomPoint() {
      const i = Math.floor(Math.random() * anchors.count);
      return root.localToWorld(new THREE.Vector3().fromBufferAttribute(anchors, i));
    },
    update(t, dt) {
      shake = Math.max(0, shake - dt * 1.2);
      root.rotation.z = .0024 * Math.sin(t * .65) + .011 * shake * Math.sin(t * 14);
      root.rotation.x = .0016 * Math.sin(t * .8);
    }
  };
}
