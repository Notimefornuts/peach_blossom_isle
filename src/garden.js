import * as THREE from '../vendor/three.module.js';
import { createCourtyard, buildCourtyardWater, WATER, BED } from './courtyard.js';
import { createRockMaterial, ROCK_TINT_GAIN } from './rock-material.js';
import {
  buildLandscape,
  shoreRadius
} from './landscape.js';
const V = (x, y, z) => new THREE.Vector3(x, y, z),
  UP = V(0, 1, 0),
  TAU = Math.PI * 2,
  G = .85;
export function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function buffer(p, ix, col, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(ix);
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
export function buildGarden({
  scene,
  low,
  register,
  assets,
  rockTextures
}) {
  const root = new THREE.Group();
  root.name = 'Island garden';
  scene.add(root);
  const rand = randomSource(389216),
    pick = a => a[Math.floor(rand() * a.length)],
    range = (a, b) => a + (b - a) * rand();
  const box = new THREE.BoxGeometry(),
    round = new THREE.SphereGeometry(1, 10, 7),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 10),
    stone = new THREE.IcosahedronGeometry(1, 1),
    cone = new THREE.CylinderGeometry(.85, 1, 1, 7);
  const blades = buffer([-.12, 0, 0, .12, 0, 0, -.17, .45, .04, .17, .45, .04, 0, 1, .29], [0, 1, 2, 1, 3, 2,
    2, 3, 4
  ]);
  const shapes = {
      box,
      round,
      cylinder,
      stone,
      cone,
      blades
    },
    bags = new Map(),
    pose = new THREE.Object3D(),
    color = new THREE.Color();
  const surface = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: .94,
    side: THREE.DoubleSide
  });
  let skipCane = false;

  // The trailing moss value tells the rock shader how much growth this
  // particular stone carries.
  function put(kind, x, y, z, sx, sy, sz, tint, rx = 0, ry = 0, rz = 0, moss = 0) {
    if (skipCane) return;
    pose.position.set(x, y, z);
    pose.scale.set(sx, sy, sz);
    pose.rotation.set(rx, ry, rz);
    pose.updateMatrix();
    if (!bags.has(kind)) bags.set(kind, []);
    bags.get(kind).push([pose.matrix.clone(), tint, moss]);
  }

  // Orientation variant for facade plants: the quaternion comes from the
  // sampled rock or soil surface, so fronds and vines lie along the slope
  // instead of standing upright or facing the camera.
  function putQ(kind, x, y, z, sx, sy, sz, tint, quat, moss = 0) {
    if (skipCane) return;
    pose.position.set(x, y, z);
    pose.scale.set(sx, sy, sz);
    pose.quaternion.copy(quat);
    pose.updateMatrix();
    if (!bags.has(kind)) bags.set(kind, []);
    bags.get(kind).push([pose.matrix.clone(), tint, moss]);
  }

  function beam(a, b, r, c, kind = 'cylinder', depth = r) {
    if (skipCane) return;
    const diff = b.clone().sub(a);
    pose.position.copy(a).lerp(b, .5);
    pose.quaternion.setFromUnitVectors(UP, diff.clone().normalize());
    pose.scale.set(r, diff.length(), depth);
    pose.updateMatrix();
    if (!bags.has(kind)) bags.set(kind, []);
    bags.get(kind).push([pose.matrix.clone(), c]);
  }

  function target(id, x, y, z, w, h, d) {
    const hit = new THREE.Mesh(box, new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false
    }));
    hit.position.set(x, y, z);
    hit.scale.set(w, h, d);
    root.add(hit);
    register(id, hit, V(x, y, z));
  }
  const courtyard = createCourtyard();
  const { curve, points: ch, sides } = courtyard;
  // The supplied stone arch has a different width from the former wood bridge.
  // Use its actual dimensions when clearing the path around the railings.
  const bridgeSize = assets?.bridge?.bounds.getSize(V());
  courtyard.bridge.width = courtyard.bridge.length * (bridgeSize ? bridgeSize.z / bridgeSize.x : .4086);
  const landscape = buildLandscape({
    root, low, put, putQ, beam, shapes, courtyard,
    channelSides: sides, channelPoints: ch, channelOutline: courtyard.outline()
  });
  const rill = buildCourtyardWater({ root, courtyard, put, shapes });
  const rillMat = rill.material;
  // Keep the original tea-set and bamboo random sequence after replacing bank details.
  for (let i = 0; i < 198; i++) rand();
  const assetMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, roughness: .88, metalness: 0,
    side: THREE.DoubleSide
  });
  const bridgeMaterial = assetMaterial.clone();
  bridgeMaterial.color.set('#ffffff');
  function placeImported(name, x, y, z, width, yaw = 0, squash = 1, glowMaterial = null) {
    const model = assets?.[name];
    if (!model) return [];
    const size = model.bounds.getSize(V());
    const scale = width / (name === 'bridge' ? size.x : Math.max(size.x, size.z));
    return model.parts.map(part => {
      const mesh = new THREE.Mesh(part.geometry, part.glow && glowMaterial ? glowMaterial :
        name === 'bridge' ? bridgeMaterial : assetMaterial);
      mesh.name = 'Provided GLB ' + name + (part.glow ? ' luminous panes' : '');
      mesh.position.set(x, y - model.bounds.min.y * scale * squash, z);
      mesh.scale.set(scale, scale * squash, scale);
      mesh.rotation.y = yaw;
      mesh.castShadow = !part.glow; mesh.receiveShadow = true;
      root.add(mesh); return mesh;
    });
  }
  const bridgeMeshes = placeImported('bridge', courtyard.bridge.center.x, G,
    courtyard.bridge.center.z, courtyard.bridge.length, courtyard.bridge.yaw);
  root.updateMatrixWorld(true);
  const bridgeRay = new THREE.Raycaster(), bridgeProfile = [];
  for (let i = 0; i <= 24; i++) {
    const along = (i / 24 - .5) * courtyard.bridge.length * .94;
    let height = G;
    for (const jitter of [-.018, 0, .018]) {
      const p = courtyard.bridge.center.clone().addScaledVector(courtyard.bridge.axis, along + jitter);
      bridgeRay.set(V(p.x, 3, p.z), V(0, -1, 0));
      const hit = bridgeRay.intersectObjects(bridgeMeshes)[0];
      if (hit) height = Math.max(height, hit.point.y);
    }
    bridgeProfile.push(height);
  }
  function bridgeSurfaceAt(x, z) {
    const {center, axis, length} = courtyard.bridge;
    const dx = x - center.x, dz = z - center.z;
    const along = dx * axis.x + dz * axis.z, across = -dx * axis.z + dz * axis.x;
    if (Math.abs(along) > length / 2 || Math.abs(across) > .37) return null;
    const s = THREE.MathUtils.clamp((along / (length * .94) + .5) * 24, 0, 24);
    const i = Math.floor(s);
    return THREE.MathUtils.lerp(bridgeProfile[i], bridgeProfile[Math.min(24, i + 1)], s - i) + .040;
  }
  function stoneSurfaceAt(x, z) {
    const seat=courtyard.meditation, d=Math.hypot(x-seat.x,z-seat.z);
    if(d<.35)return 1.212;
    if(d<seat.radius)return 1.065;
    return landscape.pathSurfaceAt(x,z);
  }
  const greens = ['#6d8c61', '#93a36f', '#839765', '#abc38a', '#597a60'];
  // Go table has a 19 by 19 grid, hoshi, a composed midgame and two bowls.
  const tx = -2.75,
    tz = 1.70,
    ty = 1.36,
    boardX = tx - .09,
    boardZ = tz + .02,
    by = ty + .07;
  put('box', tx, ty, tz, 1.92, .10, 1.30, '#79543c');
  put('box', tx, ty - .11, tz, 1.72, .13, 1.12, '#604332');
  for (const x of [-.78, .78])
    for (const z of [-.51, .51]) put('box', tx + x, 1.08, tz + z, .12, .42, .12, '#654432');
  const bc = document.createElement('canvas');
  bc.width = bc.height = 640;
  const bctx = bc.getContext('2d');
  bctx.fillStyle = '#deb880';
  bctx.fillRect(0, 0, 640, 640);
  for (let j = 0; j < 260; j++) {
    bctx.strokeStyle = j % 3 ? '#90613318' : '#fff4c52a';
    bctx.lineWidth = .5 + rand();
    bctx.beginPath();
    bctx.moveTo(rand() * 640, 0);
    bctx.lineTo(rand() * 640, 640);
    bctx.stroke();
  }
  bctx.strokeStyle = '#55452d';
  bctx.lineWidth = 1.35;
  bctx.beginPath();
  for (let j = 0; j < 19; j++) {
    const q = 36 + j * (568 / 18);
    bctx.moveTo(q, 36);
    bctx.lineTo(q, 604);
    bctx.moveTo(36, q);
    bctx.lineTo(604, q);
  }
  bctx.stroke();
  for (const x of [3, 9, 15])
    for (const z of [3, 9, 15]) {
      bctx.beginPath();
      bctx.arc(36 + x * 568 / 18, 36 + z * 568 / 18, 3, 0, TAU);
      bctx.fillStyle = '#55452d';
      bctx.fill();
    }
  const btex = new THREE.CanvasTexture(bc);
  btex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(.98, .068, .98), [surface, new THREE
    .MeshStandardMaterial({
      map: btex,
      roughness: .6
    }), surface
  ]);
  // Use a textured top plane so the grid remains sharp at close range.
  board.material = surface;
  board.position.set(boardX, by - .025, boardZ);
  root.add(board);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(.98, .98), new THREE.MeshStandardMaterial({
    map: btex,
    roughness: .77
  }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(boardX, by + .01, boardZ);
  root.add(top);
  const grid = (x, z) => V(boardX + (x - 9) * .869 / 18, by + .025, boardZ + (z - 9) * .869 / 18);
  const game = [
    [3, 3],
    [15, 15],
    [15, 3],
    [3, 15],
    [9, 3],
    [9, 15],
    [3, 9],
    [15, 9],
    [12, 3],
    [12, 4],
    [11, 4],
    [12, 5],
    [13, 4],
    [14, 5],
    [10, 4],
    [11, 3],
    [6, 14],
    [6, 15],
    [5, 15],
    [7, 14],
    [4, 15],
    [4, 14],
    [5, 14],
    [5, 13],
    [6, 12],
    [7, 12],
    [10, 10],
    [10, 11]
  ];
  game.forEach(([x, z], i) => {
    const p = grid(x, z);
    put('round', p.x, p.y, p.z, .022, .011, .022, i % 2 ? '#eee9de' : '#283132');
  });
  for (const [x, z, c] of [
      [tx - .74, tz + .43, '#343d3b'],
      [tx + .71, tz + .39, '#d6c8a9']
    ]) {
    put('round', x, ty + .065, z, .13, .075, .13, c);
    put('cylinder', x, ty + .11, z, .10, .012, .10, '#72634c');
    for (let j = 0; j < 11; j++) put('round', x + range(-.075, .075), ty + .13 + range(0, .017), z + range(-
      .075, .075), .022, .011, .022, c === '#343d3b' ? '#283132' : '#eee9de');
  }
  const cupGeo = new THREE.LatheGeometry([
    [0, 0],
    [.034, 0],
    [.052, .023],
    [.055, .07],
    [.045, .074],
    [.040, .057],
    [0, .055]
  ].map(p => new THREE.Vector2(...p)), 16);
  const teaMaterial = new THREE.MeshStandardMaterial({
    color: '#bfd0bc',
    roughness: .36
  });
  const teapotGeo = new THREE.LatheGeometry([
    [0, 0],
    [.06, 0],
    [.10, .03],
    [.115, .11],
    [.07, .17],
    [0, .18]
  ].map(p => new THREE.Vector2(...p)), 20);
  const teapot = new THREE.Mesh(teapotGeo, new THREE.MeshStandardMaterial({
    color: '#80998a',
    roughness: .40
  }));
  teapot.position.set(tx + .71, ty + .055, tz - .30);
  root.add(teapot);
  beam(V(tx + .78, ty + .14, tz - .3), V(tx + .89, ty + .23, tz - .3), .027, '#80998a');
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 9,
      b = (i + 1) * Math.PI / 9;
    beam(V(tx + .70 + .09 * Math.cos(a), ty + .24 + .12 * Math.sin(a), tz - .30), V(tx + .70 + .09 * Math.cos(
      b), ty + .24 + .12 * Math.sin(b), tz - .30), .012, '#5b6553');
  }
  const cupCenters = [
    [tx + .43, tz - .18],
    [tx + .76, tz + .025]
  ];
  for (const [x, z] of cupCenters) {
    const cup = new THREE.Mesh(cupGeo, teaMaterial);
    cup.position.set(x, ty + .055, z);
    root.add(cup);
    put('cylinder', x, ty + .114, z, .04, .004, .04, '#a17e49');
  }
  put('cylinder', tx - .74, ty + .065, tz - .35, .14, .025, .13, '#c6cdb5');
  for (let i = 0; i < 3; i++) put('round', tx - .80 + i * .055, ty + .10, tz - .35, .033, .025, .031, [
    '#e6c797', '#f1d3ad', '#d3b88e'
  ][i]);
  for (const z of [tz - .99, tz + .99]) {
    put('cylinder', tx, G + .075, z, .29, .14, .27, '#c1b58d');
    put('cylinder', tx, G + .15, z, .26, .02, .24, '#a89f79');
  }
  target('relations', tx, 1.53, tz, 2.0, .65, 1.4);
  const played = [],
    seq = [
      [11, 10],
      [11, 11],
      [12, 11],
      [12, 10],
      [13, 10],
      [13, 11],
      [14, 10],
      [14, 11]
    ];
  seq.forEach(([x, z], i) => {
    const p = grid(x, z),
      m = new THREE.Mesh(round, new THREE.MeshStandardMaterial({
        color: i % 2 ? '#eee9df' : '#293331',
        roughness: .3
      }));
    m.position.copy(p);
    m.scale.set(.022, .011, .022);
    m.visible = false;
    m.userData.dynamic = true;
    root.add(m);
    played.push({
      mesh: m,
      y: p.y,
      t: 1
    });
  });
  // Half-hidden rill and its ceramic flower cup.
  const vessel = new THREE.Group();
  root.add(vessel);
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([
    [0, 0],
    [.05, 0],
    [.09, .02],
    [.10, .07],
    [.08, .09],
    [.071, .065],
    [0, .03]
  ].map(p => new THREE.Vector2(...p)), 20), new THREE.MeshStandardMaterial({
    color: '#bb9c80',
    roughness: .5
  }));
  vessel.add(bowl);
  const blossom = new THREE.Mesh(new THREE.CircleGeometry(.026, 5), new THREE.MeshLambertMaterial({
    color: '#f0ccd0',
    side: THREE.DoubleSide
  }));
  blossom.rotation.x = -Math.PI / 2;
  blossom.position.y = .052;
  vessel.add(blossom);
  const cupHit = new THREE.Mesh(new THREE.SphereGeometry(.17, 8, 6), new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    colorWrite: false,
    depthWrite: false
  }));
  vessel.add(cupHit);
  register('cup', cupHit, curve.getPointAt(.45).add(V(0, .18, 0)));
  // Bamboo grove embraces an open stone seat, without another building.
  const {x:mx,z:mz} = courtyard.meditation;
  put('cylinder', mx, .92, mz, .72, .14, .69, '#8d9b8b');
  put('cylinder', mx, 1.01, mz, .64, .08, .61, '#bcc1aa');
  const cushionMeshes=placeImported('cushion', mx, 1.05, mz, .70, .12, .70);
  // The grove stays fixed while the whole seat assembly moves into the yard.
  const grove={x:4.12,z:.64};
  for (let j = 0; j < (low ? 22 : 33); j++) {
    const a = -2.0 + j / (low ? 21 : 32) * 3.9,
      x = grove.x + Math.cos(a) * range(.91, 1.30),
      z = grove.z - 1 + Math.sin(a) * range(.68, 1.0),
      h = range(1.6, 3.1);
    // Retain the grove's positions and random sequence, clearing only stalks
    // whose roots would pierce the existing circular meditation seat.
    skipCane = Math.hypot(x - grove.x, z - grove.z) < .83;
    let prev = V(x, G, z);
    for (let k = 1; k <= 7; k++) {
      const u = k / 7,
        next = V(x + .16 * u * u, G + h * u, z + .10 * u * u);
      beam(prev, next, range(.025, .039), pick(['#6a886a', '#819873', '#4d7462']));
      put('cylinder', next.x, next.y, next.z, .043, .02, .043, '#a1ad7b');
      if (k > 3) {
        for (let s = 0; s < 3; s++) {
          const end = next.clone().add(V((s % 2 ? 1 : -1) * range(.25, .47), range(.07, .25), range(-.25,
            .25)));
          beam(next, end, .006, '#71925f');
          for (let n = 0; n < 4; n++) {
            const p = next.clone().lerp(end, (n + 1) / 4);
            put('blades', p.x, p.y, p.z, .14, .27, .14, pick(greens), range(.8, 1.8), rand() * TAU);
          }
        }
      }
      prev = next;
    }
  }
  skipCane = false;
  const { x: lx, z: lz } = courtyard.lantern;
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, roughness: .83,
    emissive: '#ffc274', emissiveIntensity: .08, side: THREE.DoubleSide
  });
  const lampMeshes = placeImported('lantern', lx, G, lz, .57, -.18, 1, lampMat);
  const lampLight = new THREE.PointLight('#ffc077', 0, 3.0, 2);
  lampLight.position.set(lx, 1.50, lz); scene.add(lampLight);
  target('practice', mx, 1.42, mz, .95, .70, .90);
  target('practice', lx, 1.40, lz, .65, 1.10, .65);
  // The open waterside paving replaces the removed park bench as the healing anchor.
  const healing = courtyard.healing;
  target('healing', healing.x, healing.y, healing.z, .78, .35, .65);
  for (const mesh of bridgeMeshes) register('healing', mesh, healing);
  for (let i = 0; i < 70; i++) {
    const x = range(-5.2, 5.2),
      z = range(-3.8, 3.9);
    if (Math.hypot(x, z) < shoreRadius(Math.atan2(z, x)) - .3 && !(x > -1.3 && x < 3.8 && z < .5)) put(
      'round', x, (courtyard.at(x, z).distance < courtyard.at(x, z).width ? WATER : landscape.groundHeight(x, z)) + .015, z, .022, .004, .014, pick(['#ecc9c3', '#e6b8c0',
        '#f6dfd4'
      ]), 0, rand() * TAU);
  }
  // Every stone shares one weathered material; the plants keep the plain one.
  const rockMaterial = createRockMaterial(rockTextures, low);
  const rockRandom = randomSource(90210);
  const tintProbe = new THREE.Color();
  const isRockKind = kind => kind.startsWith('bankRock') || kind.startsWith('pathSlab');
  for (const [kind, list] of bags) {
    const rocky = isRockKind(kind);
    const m = new THREE.InstancedMesh(shapes[kind], rocky ? rockMaterial : surface, list.length);
    m.name = 'Garden ' + kind;
    list.forEach(([mx, c, moss], i) => {
      m.setMatrixAt(i, mx);
      // The detail map darkens the stone, so the tint is lifted to keep the
      // island's established value.
      m.setColorAt(i, color.set(c).multiplyScalar(rocky ? ROCK_TINT_GAIN : 1));
    });
    if (rocky) {
      // A per instance offset and scale break the shared tiling, so two
      // neighbouring boulders never show the same patch of stone.
      const data = new Float32Array(list.length * 4);
      for (let i = 0; i < list.length; i++) {
        tintProbe.set(list[i][1]);
        const growth = list[i][2] > 0 ? list[i][2]
          : (tintProbe.g > tintProbe.r * 1.08 && tintProbe.g > tintProbe.b * 1.08 ? .9 : .3);
        data[i * 4] = rockRandom();
        data[i * 4 + 1] = rockRandom();
        data[i * 4 + 2] = .86 + rockRandom() * .30;
        data[i * 4 + 3] = growth;
      }
      shapes[kind].setAttribute('aRockData', new THREE.InstancedBufferAttribute(data, 4));
    }
    m.castShadow = true;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    root.add(m);
  }
  const steam = cupCenters.map(([x, z]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(42), 3));
    const m = new THREE.Line(g, new THREE.LineBasicMaterial({
      color: '#fcf6e4',
      transparent: true,
      opacity: .23,
      depthWrite: false
    }));
    m.position.set(x, ty + .13, z);
    m.frustumCulled = false;
    root.add(m);
    return g.attributes.position;
  });
  vessel.traverse(m => {
    if (m.isMesh) m.userData.dynamic = true;
  });
  let mode = 0,
    move = 0,
    progress = .45,
    boost = 0,
    light = .08,
    lightGoal = .08;
  return {
    root,
    shoreRadius,
    courtyard,
    bridgeSurfaceAt,
    stoneSurfaceAt,
    imported: { bridge: bridgeMeshes, lantern: lampMeshes, cushion:cushionMeshes },
    groundHeight: landscape.groundHeight,
    streamAt(x, z) {
      const sample = courtyard.at(x, z);
      return sample.distance < sample.width * .80 ? sample : null;
    },
    flowPetal(p, dt, time) {
      p.streamU += dt * .011;
      if (p.streamU > .99) return false;
      const q = curve.getPointAt(p.streamU), tangent = curve.getTangentAt(p.streamU);
      p.x = q.x - tangent.z * p.streamOffset;
      p.z = q.z + tangent.x * p.streamOffset;
      p.y = WATER + .011 + .002 * Math.sin(time + p.a);
      return true;
    },
    setTime(v) {
      mode = v;
      lightGoal = [.08, .58, 1.1][v];
      rillMat.color.set(['#69b9b2', '#9caab1', '#477c8c'][v]);
    },
    act(id) {
      if (id === 'relations') {
        if (move === played.length) {
          played.forEach(p => p.mesh.visible = false);
          move = 0;
        }
        const p = played[move++];
        p.mesh.visible = true;
        p.t = 0;
      }
      if (id === 'practice') lightGoal = lightGoal > .65 ? .1 : 1.5;
      if (id === 'cup') boost = 4;
      if (id === 'healing' || id === 'cup') rill.ripple();
    },
    update(t, dt) {
      for (const p of played)
        if (p.t < 1) {
          p.t = Math.min(1, p.t + dt * 2.7);
          p.mesh.position.y = p.y + .30 * (1 - p.t * p.t);
        }
      boost = Math.max(0, boost - dt);
      progress = (progress + dt * (boost ? .032 : .0035)) % 1;
      rill.update(t);
      vessel.position.copy(curve.getPointAt(progress));
      vessel.position.y = WATER + .004;
      vessel.rotation.y = progress * 3 + Math.sin(t * .4);
      vessel.rotation.z = .025 * Math.sin(t);
      vessel.scale.setScalar(.70 * Math.min(1, progress / .025, (1 - progress) / .025));
      light = THREE.MathUtils.damp(light, lightGoal, 3, dt);
      lampMat.emissiveIntensity = light;
      lampLight.intensity = light * (mode === 2 ? 2.0 : .5);
      steam.forEach((p, k) => {
        for (let i = 0; i < 14; i++) {
          const u = i / 13;
          p.setXYZ(i, .028 * u * Math.sin(t * 1.3 + u * 8 + k), u * .20, .015 * u * Math.cos(t + u * 5));
        }
        p.needsUpdate = true;
      });
    }
  };
}
