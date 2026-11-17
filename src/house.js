import * as THREE from '../vendor/three.module.js';
import { buildRoof } from './roof.js';
import { buildWindowLattice } from './windows.js';

// The ridge runs east–west. Walls, window joinery and furniture share batches;
// each hinged door leaf, the book and the bell keep their own transform.
export function buildHouse({
  scene,
  low,
  register
}) {
  const hut = new THREE.Group();
  hut.name = '桃花岛 · 两层木屋';
  scene.add(hut);
  hut.position.set(1.1, .85, -1.25);
  hut.scale.set(1.20, .92, 1.04);
  let seed = 1718;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  const grain = document.createElement('canvas');
  grain.width = 256;
  grain.height = 128;
  const ctx = grain.getContext('2d');
  ctx.fillStyle = '#f1dfbe';
  ctx.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 145; i++) {
    const y = random() * 132 - 2,
      wave = .3 + random() * 1.8,
      phase = random() * 6;
    ctx.strokeStyle = random() < .75 ? 'rgba(88,49,29,.13)' : 'rgba(255,250,228,.53)';
    ctx.lineWidth = .3 + random() * .8;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const yy = y + Math.sin(x * Math.PI / 128 + phase) * wave + Math.sin(x * Math.PI / 32 + phase) * .28;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  const woodmap = new THREE.CanvasTexture(grain);
  woodmap.colorSpace = THREE.SRGBColorSpace;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: .82,
    ...extra
  });
  const timber = mat(0xad8258, {
      map: woodmap,
      roughness: .62
    }),
    dark = mat(0x634835, {
      map: woodmap
    }),
    honey = mat(0xc9a173, {
      map: woodmap,
      roughness: .58
    });
  const warmPlanks = [0xbf9870, 0xc7a177, 0xb99268, 0xcaa780].map(c => mat(c, {
    map: woodmap
  }));
  const cream = mat(0xe6d8bc),
    plaster = mat(0xf2e6ce),
    base = mat(0x706e65);
  const paper = mat(0xffecd0, {
    emissive: 0xffaf57,
    emissiveIntensity: .01
  });
  const windowPaper = mat(0xf5e6c9, {
    transparent: true,
    opacity: .18,
    depthWrite: false,
    emissive: 0xffc27c,
    emissiveIntensity: .01,
    roughness: .94
  });
  const shadow = mat(0x493b32),
    roofEdge = mat(0x4e5f62);
  const slate = [0x647d82, 0x71858a, 0x779097, 0x6b8389, 0x708b8f, 0x60777e].map(c => mat(c, {
    roughness: .63
  }));
  const roofRib = mat(0x84969a, {
      roughness: .65
    }),
    roofAccent = mat(0x99a9a8);
  const green = mat(0x708266),
    sage = mat(0x95a284),
    rose = mat(0xb98484),
    ink = mat(0x455151);
  const gold = mat(0xab8b56, {
      metalness: .32,
      roughness: .54
    }),
    ceramic = mat(0x824f3b, {
      roughness: .32
    });
  const celadon = mat(0xc1d3bf, {
      roughness: .32
    }),
    page = mat(0xf2e5cd);
  const batches = new Map();
  const cube = new THREE.BoxGeometry(1, 1, 1),
    sphere = new THREE.SphereGeometry(1, 12, 8);
  const cylinderCache = new Map();
  const vec = (x, y, z) => new THREE.Vector3(x, y, z);
  const rot = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

  function add(geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, q = rot(), group = hut) {
    if (!batches.has(group)) batches.set(group, new Map());
    const batch = batches.get(group);
    if (!batch.has(material)) batch.set(material, {
      p: [],
      n: [],
      u: [],
      idx: []
    });
    const data = batch.get(material),
      start = data.p.length / 3;
    const m = new THREE.Matrix4().compose(vec(x, y, z), q, vec(sx, sy, sz));
    const normal = new THREE.Matrix3().getNormalMatrix(m),
      v = vec(0, 0, 0);
    const {
      position,
      normal: n,
      uv
    } = geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(m);
      data.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyNormalMatrix(normal);
      data.n.push(v.x, v.y, v.z);
      data.u.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    if (geometry.index)
      for (const i of geometry.index.array) data.idx.push(start + i);
    else
      for (let i = 0; i < position.count; i++) data.idx.push(start + i);
  }
  const box = (x, y, z, w, h, d, m = timber, group = hut, q = rot()) => add(cube, m, x, y, z, w, h, d, q,
    group);
  const ball = (x, y, z, rx, ry, rz, m, group = hut) => add(sphere, m, x, y, z, rx, ry, rz, rot(), group);
  // The long axis of each beam follows the wood grain on its broad faces.
  function beam(a, b, w, d, m = timber, group = hut) {
    const dir = b.clone().sub(a),
      l = dir.length(),
      mid = a.clone().lerp(b, .5);
    const q = new THREE.Quaternion().setFromUnitVectors(vec(1, 0, 0), dir.normalize());
    box(mid.x, mid.y, mid.z, l, w, d, m, group, q);
  }

  function tube(a, b, rA, rB, m, seg = 10, group = hut) {
    const key = [rA, rB, seg].join('/');
    if (!cylinderCache.has(key)) cylinderCache.set(key, new THREE.CylinderGeometry(rB, rA, 1, seg));
    const dir = b.clone().sub(a),
      l = dir.length(),
      mid = a.clone().lerp(b, .5);
    const q = new THREE.Quaternion().setFromUnitVectors(vec(0, 1, 0), dir.normalize());
    add(cylinderCache.get(key), m, mid.x, mid.y, mid.z, 1, l, 1, q, group);
  }

  function lathe(x, y, z, points, m, group = hut) {
    const geom = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), 16);
    add(geom, m, x, y, z, 1, 1, 1, rot(), group);
  }

  function linePath(points, r, m, group = hut) {
    for (let i = 1; i < points.length; i++) tube(points[i - 1], points[i], r, r, m, 6, group);
  }

  function arc(x, y, z, r, h, m, rad = .009) {
    const points = [];
    for (let i = 0; i <= 12; i++) {
      const a = i * Math.PI / 12;
      points.push(vec(x + r * Math.cos(a), y + h * Math.sin(a), z));
    }
    linePath(points, rad, m);
  }

  function triangle(a, b, c, m) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...c, ...b, ...a], 3));
    g.computeVertexNormals();
    add(g, m);
  }
  // Structural bays retain the reference's warm timber and recessed plaster.
  function floor(cx, y, cz, w, d) {
    box(cx, y - .08, cz, w, .16, d, dark);
    const n = Math.ceil(w / .18);
    for (let i = 0; i < n; i++) box(cx - w / 2 + (i + .5) * w / n, y + .012, cz, w / n - .007, .025, d - .018,
      warmPlanks[i % 4]);
  }

  const openings = [];
  // Split plaster around an opening, so a window never covers a solid wall.
  function windowWall(name, axis, plane, lo, hi, bottom, top, center, sill, width, height, outward = 1,
    style = 'bubu', panels = 1, detailed = false) {
    const face = (u, y, w, h, depth, m, offset = 0) => {
      if (w <= 0 || h <= 0) return;
      if (axis === 'x') box(u, y, plane + offset, w, h, depth, m);
      else box(plane + offset, y, u, depth, h, w, m);
    };
    const left = center - width / 2,
      right = center + width / 2,
      head = sill + height;
    face((lo + left) / 2, (bottom + top) / 2, left - lo, top - bottom, .12, plaster);
    face((right + hi) / 2, (bottom + top) / 2, hi - right, top - bottom, .12, plaster);
    face(center, (bottom + sill) / 2, width, sill - bottom, .12, cream);
    face(center, (head + top) / 2, width, top - head, .12, plaster);
    // Deep jambs, inner stops, projecting sill and a small weathering head.
    for (const u of [left + .033, right - .033]) face(u, sill + height / 2, .066, height, .17, timber);
    for (const y of [sill + .031, head - .031]) face(center, y, width, .062, .17, honey);
    face(center, sill - .035, width + .19, .075, .29, honey, outward * .035);
    face(center, head + .018, width + .13, .054, .22, timber, outward * .018);
    const innerW = width - .145,
      innerH = height - .14;
    buildWindowLattice({
      width: innerW, height: innerH, style, panels, detailed, low,
      materials: { timber, dark },
      rectangle: (u, v, w, h, d, m, offset) => face(center + u, sill + height / 2 + v,
        w, h, d, m, outward * offset),
      contour: (geometry, material, offset) => {
        const angle = axis === 'x' ? (outward > 0 ? 0 : Math.PI) : outward * Math.PI / 2;
        const x = axis === 'x' ? center : plane + outward * offset;
        const z = axis === 'x' ? plane + outward * offset : center;
        add(geometry, material, x, sill + height / 2, z, 1, 1, 1, rot(0, angle, 0));
      }
    });
    // One thin geometric paper sheet behind the grille; the furniture stays visible.
    face(center, sill + height / 2, innerW, innerH, .006, windowPaper, -outward * .038);
    openings.push({
      name,
      style,
      panels,
      axis,
      plane,
      left,
      right,
      sill,
      head,
      wall: {
        lo,
        hi,
        bottom,
        top
      }
    });
  }

  function rail(x, y, z, len, side = false) {
    const p = (u, v, w, h, m) => side ? box(x, y + v, z + u, .047, h, w, m) : box(x + u, y + v, z, w, h, .047,
      m);
    p(0, .37, len, .047, honey);
    p(0, .09, len, .042, dark);
    for (let i = 0; i <= len / .18; i++) p(-len / 2 + i * .18, .23, .028, .29, timber);
  }
  const roofs = [];

  function roof(cx, cz, w, d, eave, rise) {
    const record = { cx, cz, w, d, eave, rise };
    roofs.push(record);
    const detail = buildRoof({
      cx, cz, w, d, eave, rise, low, add, box, beam, tube,
      materials: { slate, roofEdge, roofRib, timber, honey, dark }
    });
    const { surface } = detail;
    for (let i = 0; i < 18; i++) {
      const p = surface(Math.sin(i * 17.3) * .95, .08 + .6 * random(), i % 5 ? 0 : 1);
      ball(p.x, p.y + .025, p.z, .026, .006, .014, i % 3 ? rose : page);
    }
  }
  box(0, .10, 0, 4.65, .20, 3.12, base);
  floor(0, .23, .08, 4.83, 3.42);
  windowWall('一层书房正窗', 'x', 1.28, -2.15, -.84, .255, 1.84, -1.50, .80, 1.06, .88, 1, 'bubu', 1, true);
  windowWall('一层客厅正窗', 'x', 1.28, .58, 2.15, .255, 1.84, 1.365, .80, 1.27, .88, 1, 'haitang');
  windowWall('一层书房侧窗', 'z', -2.15, -1.36, 1.28, .255, 1.84, .10, .84, 1.77, .78, -1, 'bubu', 2);
  windowWall('一层客厅侧窗', 'z', 2.15, -1.36, 1.28, .255, 1.84, .08, .84, 1.78, .78, 1, 'bubu', 2);
  box(0, 1.045, -1.36, 4.37, 1.58, .12, plaster);
  for (const z of [-1.36, 1.28]) {
    // The entrance interrupts the front skirting, while the rear is continuous.
    if (z < 0) box(0, .31, z, 4.37, .10, .145, dark);
    else
      for (const [x, width] of [
          [-1.50, 1.31],
          [1.365, 1.57]
        ]) box(x, .31, z, width, .10, .145, dark);
  }
  for (const x of [-2.15, -.84, .58, 2.15])
    for (const z of [-1.35, 1.28]) {
      box(x, .33, z, .24, .14, .25, base);
      box(x, 1.08, z, .125, 1.57, .13, dark);
      box(x, 1.78, z, .23, .10, .21, honey);
      box(x, 1.85, z, .34, .11, .23, timber);
    }
  // Only the beam beneath the shallow study roof is rebated to seat below
  // its tiles. The main house beam keeps its original elevation and section.
  for (const z of [-1.36, 1.28]) {
    box(-1.5525, 1.855, z, 1.445, .10, .16, dark);
    box(.7225, 1.88, z, 3.105, .15, .16, dark);
  }
  for (const x of [-2.1, -.83, .6, 2.1]) box(x, 1.88, 0, .12, .12, 2.81, timber);
  // The rear indoor staircase is enclosed within the main house. Three floor
  // panels surround its opening; the upper floor ends flush with the walls.
  floor(.69, 2.02, .255, 3.18, 1.69);
  floor(-.70, 2.02, -.94, .40, .70);
  floor(.69, 2.02, -1.30, 3.18, .18);
  box(.70, 1.94, -.585, 3.07, .16, .12, dark);
  box(.69, 2.7875, -1.27, 3.04, 1.485, .105, plaster);
  box(-.83, 2.7875, -.135, .12, 1.485, 2.39, cream);
  windowWall('二层卧室正窗', 'x', 1.02, -.83, 2.20, 2.045, 3.53, .685, 2.42, 2.62, .96, 1, 'bubu', 3);
  // The bedroom wall facing the bamboo is closed for now; the front lattice
  // window remains, and the side plaster meets the existing corner posts.
  box(2.20, 2.7875, -.125, .12, 1.485, 2.29, plaster);
  box(2.20, 1.965, -.125, .16, .25, 2.29, dark);
  for (const x of [-.83, 2.20])
    for (const z of [-1.27, 1.02]) {
      box(x, 2.81, z, .125, 1.58, .125, dark);
      box(x, 3.48, z, .25, .10, .20, honey);
      for (let k = 0; k < 3; k++) box(x, 3.37 + k * .075, z + (z > 0 ? 1 : -1) * k * .07, .16 + k * .09, .065,
        .19 + k * .06, timber);
    }
  for (const z of [-1.28, 1.02]) box(.69, 3.56, z, 3.31, .16, .17, dark);
  // A low indoor guard protects the stair opening behind the bed.
  rail(.84, 2.045, -.59, 2.58);
  for (const x of [-.45, .84, 2.13]) box(x, 2.255, -.59, .070, .42, .070, timber);
  roof(.65, -.12, 4.12, 3.43, 3.57, 1.02);
  roof(-1.65, -.09, 1.73, 3.25, 1.92, .61);
  for (let i = 0; i < 12; i++) box(1.73 - i * .20, .31 + i * .153, -.91, .232, .085, .50, honey);
  for (const z of [-1.18, -.64]) beam(vec(1.86, .27, z), vec(-.59, 2.03, z), .08, .08, dark);
  beam(vec(1.80, .68, -1.19), vec(-.57, 2.39, -1.19), .038, .038, honey);
  for (const i of [0, 5, 11]) {
    const x = 1.73 - i * .20, y = .31 + i * .153;
    beam(vec(x, y + .035, -1.19), vec(x, y + .42, -1.19), .034, .034, timber);
  }
  for (let i = 0; i < 3; i++) box(-.13, .02 + i * .051, 1.98 - i * .13, 1.05, .10 + i * .11, .23, base);

  // A recessed frame and independent inward hinges define the main entrance.
  for (const x of [-.751, .491]) box(x, 1.03, 1.28, .070, 1.51, .17, timber);
  box(-.13, 1.80, 1.28, 1.38, .11, .19, honey);
  box(-.13, .295, 1.28, 1.35, .07, .22, honey);
  const doors = [];

  function doorLeaf(side, hingeX, sign, initial) {
    const group = new THREE.Group();
    group.name = '中式木门 · ' + (side === 'left' ? '左扇' : '右扇');
    group.position.set(hingeX, .34, 1.205);
    group.rotation.y = sign * initial;
    group.userData.doorSide = side;
    hut.add(group);
    const w = .562,
      h = 1.36,
      mid = sign * (.008 + w / 2);
    const part = (u, y, width, height, depth, material, z = .029) =>
      box(sign * u, y, z, width, height, depth, material, group);
    for (const x of [.038, .543]) part(x, h / 2, .060, h, .058, timber);
    for (const [y, thickness] of [
        [.038, .076],
        [.565, .067],
        [1.327, .066]
      ])
      part(.292, y, w, thickness, .058, honey);
    part(.292, .30, .447, .425, .037, timber);
    part(.292, .30, .376, .35, .045, honey);
    for (const x of [.144, .292, .440]) part(x, .30, .006, .35, .004, timber, .055);
    for (let i = 1; i < 5; i++) part(.068 + i * .448 / 5, .951, .019, .695, .041, timber);
    for (const y of [.690, .790, 1.175, 1.270]) part(.292, y, .448, .019, .041, timber);
    // Actual hinge knuckles, leaf plates, studs and a bronze ring handle.
    for (const y of [.25, 1.10]) {
      box(hingeX, .34 + y, 1.205, .034, .14, .04, gold);
      tube(vec(hingeX, .34 + y - .065, 1.205), vec(hingeX, .34 + y + .065, 1.205), .016, .016, gold, 8);
      part(.010, y, .020, .112, .055, gold, .032);
      part(.047, y, .077, .105, .012, gold, .060);
      for (const yy of [y - .028, y + .028]) ball(sign * .063, yy, .066, .006, .006, .003, gold, group);
    }
    part(.492, .64, .065, .083, .012, gold, .064);
    ball(sign * .492, .65, .080, .014, .014, .01, gold, group);
    add(new THREE.TorusGeometry(.037, .0065, 6, 16), gold,
      sign * .492, .615, .086, 1, 1, 1, rot(), group);
    const door = {
      id: 'door-' + side,
      group,
      sign,
      open: true,
      angle: initial,
      target: initial
    };
    group.userData.door = door;
    doors.push(door);
    // Raycast the wooden geometry, so empty lattice cells remain transparent to picking.
    register(door.id, group, hut.localToWorld(vec(hingeX + mid, 1.03, 1.23)), {
      marker: false
    });
  }
  doorLeaf('left', -.708, 1, THREE.MathUtils.degToRad(52));
  doorLeaf('right', .448, -1, THREE.MathUtils.degToRad(40));

  function table(x, y, z, w, d, h) {
    box(x, y + h, z, w, .065, d, honey);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) box(x + a * (w / 2 - .065), y + h / 2, z + b * (d / 2 - .065), .055, h, .055,
        dark);
  }
  table(-1.67, .255, .77, .72, .58, .50);
  for (let row = 0; row < 3; row++) box(-1.73, .31 + row * .31, -1.06, .70, .042, .29, timber);
  for (const x of [-2.06, -1.4]) box(x, .74, -1.06, .042, .96, .31, dark);
  for (let row = 0; row < 3; row++)
    for (let j = 0; j < 8; j++) box(-2 + j * .074, .43 + row * .31, -1.04, .052, .20 + random() * .05, .20, [
      green, ink, rose, cream
    ][(row + j) % 4]);
  lathe(-1.95, .79, .74, [
    [0, 0],
    [.045, 0],
    [.048, .15],
    [.035, .17]
  ], ceramic);
  for (let j = 0; j < 4; j++) tube(vec(-1.95 + j * .01, .88, .74), vec(-2.00 + j * .035, 1.11, .76), .005,
    .004, timber, 5);
  box(-1.4, .80, .83, .13, .024, .085, ink);
  for (let i = 0; i < 2; i++) tube(vec(-1.92 + i * .17, .80, .58), vec(-1.92 + i * .17, .80, .81), .025, .025,
    page, 9);
  table(.81, .255, .04, 1.00, .60, .28);
  for (const x of [.10, 1.78]) ball(x, .33, .04, .25, .065, .25, green);
  lathe(1.01, .59, .04, [
    [0, 0],
    [.06, 0],
    [.08, .09],
    [.04, .16],
    [.035, .20]
  ], celadon);
  for (let i = 0; i < 5; i++) {
    const end = vec(.9 + random() * .23, .91 + random() * .13, -.03 + random() * .15);
    tube(vec(1.01, .75, .04), end, .005, .003, timber, 5);
    ball(end.x, end.y, end.z, .035, .022, .03, rose);
  }
  box(1.70, .52, -.405, .70, .53, .33, timber);
  box(1.70, .81, -.405, .76, .05, .35, dark);
  for (const x of [1.53, 1.87]) {
    box(x, .53, -.233, .31, .39, .023, honey);
    ball(x, .54, -.215, .02, .02, .015, gold);
  }
  // Bed, quilt, soft pillows and a reachable paper lantern.
  for (const x of [.07, 1.23])
    for (const z of [-.43, .71]) box(x, 2.1025, z, .09, .115, .09, dark);
  box(.65, 2.24, .14, 1.42, .22, 1.39, dark);
  box(.65, 2.40, .14, 1.38, .11, 1.34, page);
  box(.65, 2.48, .36, 1.34, .08, .85, sage);
  for (let i = 0; i < 5; i++) box(.65, 2.525, .49 + i * .06, 1.28, .005, .012, cream);
  for (const x of [.29, .98]) ball(x, 2.51, -.29, .25, .062, .14, page);
  table(1.78, 2.05, .26, .51, .41, .35);

  function lantern(x, y, z, s) {
    tube(vec(x, y, z), vec(x, y + .32 * s, z), .11 * s, .11 * s, paper, 12);
    tube(vec(x, y - .024 * s, z), vec(x, y, z), .13 * s, .13 * s, dark, 12);
    tube(vec(x, y + .32 * s, z), vec(x, y + .35 * s, z), .13 * s, .13 * s, dark, 12);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      tube(vec(x + Math.cos(a) * .112 * s, y, z + Math.sin(a) * .112 * s), vec(x + Math.cos(a) * .112 * s, y +
        .32 * s, z + Math.sin(a) * .112 * s), .005 * s, .005 * s, honey, 4);
    }
  }
  lantern(1.78, 2.44, .26, .9);
  lantern(-1.96, .79, .55, .50);
  // Painted scrolls and tiny red seals bring the reference's lived-in interior upstairs.
  for (const [x, y, z] of [
      [.06, 1.19, -1.283],
      [.04, 2.93, -1.197]
    ]) {
    box(x, y, z, .48, .73, .025, green);
    box(x, y, z + .016, .40, .62, .012, page);
    for (const sy of [-1, 1]) tube(vec(x - .27, y + sy * .37, z + .02), vec(x + .27, y + sy * .37, z + .02),
      .018, .018, dark, 8);
    linePath([vec(x - .13, y - .21, z + .03), vec(x - .05, y - .04, z + .03), vec(x + .02, y + .12, z + .03),
      vec(x + .13, y + .20, z + .03)
    ], .006, ink);
    box(x + .13, y - .21, z + .031, .035, .043, .005, rose);
  }
  const pages = new THREE.Group();
  pages.position.set(-1.69, .80, .83);
  hut.add(pages);
  box(.082, 0, 0, .176, .017, .21, green, pages);
  box(.082, .014, 0, .17, .018, .204, page, pages);
  const leaf = new THREE.Group();
  leaf.position.y = .025;
  pages.add(leaf);
  box(.082, 0, 0, .17, .012, .204, page, leaf);
  for (let i = 0; i < 5; i++) box(.04 + i * .019, -.007, 0, .004, .002, .14 - i * .013, ink, leaf);
  const bell = new THREE.Group();
  bell.position.set(2.28, 3.55, 1.42);
  hut.add(bell);
  tube(vec(0, 0, 0), vec(0, -.12, 0), .004, .004, dark, 4, bell);
  lathe(0, -.24, 0, [
    [.075, 0],
    [.065, .07],
    [.02, .12],
    [0, .122]
  ], celadon, bell);
  tube(vec(0, -.17, 0), vec(0, -.33, 0), .003, .003, dark, 4, bell);
  box(0, -.43, 0, .055, .2, .007, page, bell);
  for (const [group, materials] of batches)
    for (const [m, d] of materials) {
      m.side = m === windowPaper ? THREE.FrontSide : THREE.DoubleSide;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(d.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(d.u, 2));
      g.setIndex(d.idx);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (m === windowPaper) {
        mesh.castShadow = false;
        mesh.renderOrder = 3;
      }
      group.add(mesh);
    }
  for (const door of doors) door.group.traverse(m => {
    if (m.isMesh) m.userData.dynamic = true;
  });
  leaf.traverse(m => {
    if (m.isMesh) m.userData.dynamic = true;
  });
  bell.traverse(m => {
    if (m.isMesh) m.userData.dynamic = true;
  });
  const lamp = new THREE.PointLight(0xffc082, 0, 4.5, 2);
  lamp.position.copy(hut.localToWorld(vec(1.78, 2.61, .26)));
  scene.add(lamp);
  const livingLamp = new THREE.PointLight(0xffc98a, 0, 4.0, 2);
  livingLamp.position.copy(hut.localToWorld(vec(.83, 1.38, .18)));
  scene.add(livingLamp);

  function target(id, x, y, z, w, h, d) {
    const hit = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false
    }));
    hit.position.set(x, y, z);
    hit.scale.set(w, h, d);
    hut.add(hit);
    register(id, hit, hut.localToWorld(vec(x, y, z)));
  }
  target('study', -1.73, .9, .77, 1.02, .65, .70);
  target('sleep', 1.78, 2.58, .26, .50, .60, .53);
  target('healing', .81, .62, .04, 1.2, .6, .80);
  let mode = 0,
    light = 1,
    opened = false,
    angle = 0,
    doorsChanged = false;

  function illuminate() {
    paper.emissiveIntensity = [.02, .65, 1.13][mode] * light;
    windowPaper.emissiveIntensity = [.01, .16, .32][mode] * (.8 + light * .2);
    lamp.intensity = [.08, 2.3, 4.4][mode] * light;
    livingLamp.intensity = [.04, 1.4, 2.8][mode];
  }
  return {
    root: hut,
    openings,
    doors,
    get doorsChanged() {
      return doorsChanged;
    },
    roofHeight(x, z) {
      x = (x - hut.position.x) / hut.scale.x;
      z = (z - hut.position.z) / hut.scale.z;
      let h = 0;
      for (const r of roofs) {
        const a = r.w / 2,
          c = r.d / 2,
          hip = Math.max(.15, a - c * .75),
          dx = Math.abs(x - r.cx),
          dz = Math.abs(z - r.cz);
        if (dx > a || dz > c) continue;
        const q = Math.max(dz / c, (dx - hip) / (a - hip), 0);
        h = Math.max(h, hut.position.y + (r.eave + r.rise * (1 - q) ** 1.42 + .02) * hut.scale.y);
      }
      return h;
    },
    act(id) {
      const door = doors.find(d => d.id === id);
      if (door) {
        door.open = !door.open;
        door.target = door.open ? THREE.MathUtils.degToRad(82) : 0;
      }
      if (id === 'study') opened = !opened;
      if (id === 'sleep') {
        light = light === 1 ? 1.8 : light > 1 ? .25 : 1;
        illuminate();
      }
    },
    setTime(value) {
      mode = value;
      illuminate();
    },
    update(t, dt) {
      doorsChanged = false;
      for (const door of doors) {
        if (Math.abs(door.angle - door.target) < .0001) continue;
        doorsChanged = true;
        door.angle = THREE.MathUtils.damp(door.angle, door.target, 5.5, dt);
        if (Math.abs(door.angle - door.target) < .0001) door.angle = door.target;
        door.group.rotation.y = door.sign * door.angle;
      }
      angle = THREE.MathUtils.damp(angle, opened ? Math.PI : 0, 4, dt);
      leaf.rotation.z = angle;
      bell.rotation.z = .09 * Math.sin(t * 1.4) + .03 * Math.sin(t * 2.1);
      bell.rotation.x = .03 * Math.cos(t);
    }
  };
}
