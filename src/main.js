import * as THREE from '../vendor/three.module.js';
import { loadCourtyardModels } from './model-assets.js';
import { loadRockTextures } from './rock-material.js';
import {
  OrbitControls
} from '../vendor/OrbitControls.js';
import {
  SoftRenderer
} from './software.js';
import {
  buildHouse
} from './house.js';
import {
  buildGarden
} from './garden.js';
import {
  buildTree
} from './tree.js';
import {
  buildLake
} from './lake.js';
import {
  buildPetals
} from './petals.js';
import {
  createSound
} from './sound.js';
import {
  places,
  labels,
  scripture
} from './content.js';
async function boot() {
const $ = s => document.querySelector(s),
  V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let language = 0,
  mode = 0,
  selected = '',
  tab = 0,
  pure = false,
  audible = false;
const tr = (zh, en) => language ? en : zh;
const drawing = {
  day: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
  dusk: '<path d="M2 17h20M5 20h14M7 15a5 5 0 0 1 10 0M12 4v3M3 10l2 1m14 0 2-1M6 5l2 3m10-3-2 3"/>',
  night: '<path d="M19.7 15.6A8.2 8.2 0 0 1 9.1 4.1 8.5 8.5 0 1 0 19.7 15.6Z"/>',
  quiet: '<path d="M11 5 6 9H3v6h3l5 4ZM16 9l5 6m0-6-5 6"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4ZM15 8q4 4 0 8m3-11q7 7 0 14"/>',
  reset: '<path d="M4 11a8 8 0 1 1 2 7M4 5v6h6"/>',
  pure: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  back: '<path d="m10 5-7 7 7 7M3 12h17"/>',
  drag: '<path d="M9 13V6a1.3 1.3 0 1 1 2.6 0v5-7a1.3 1.3 0 0 1 2.6 0v7-5a1.3 1.3 0 0 1 2.6 0v6-3a1.2 1.2 0 0 1 2.4 0v6q0 7-6 7h-1q-3 0-5-3l-3-5q-.8-2 1.3-2l3.5 3"/>',
  again: '<path d="m6 5 11 7-11 7Z"/>'
};
const icon = k =>
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
  drawing[k] + '</svg>';
const stage = $('#stage'),
  small = innerWidth < 700 || navigator.hardwareConcurrency <= 4,
  reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const canvas = document.createElement('canvas');
stage.append(canvas);
const gl = canvas.getContext('webgl2', {
  alpha: true,
  antialias: true,
  powerPreference: small ? 'low-power' : 'high-performance'
});
const renderer = gl ? new THREE.WebGLRenderer({
  canvas,
  context: gl,
  alpha: true,
  antialias: true
}) : new SoftRenderer();
if (!gl) {
  canvas.remove();
  stage.append(renderer.domElement);
}
renderer.setClearColor(0, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !small;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
const low = small || !gl,
  scene = new THREE.Scene(),
  world = new THREE.Group();
scene.add(world);
const sky = new THREE.HemisphereLight(),
  sun = new THREE.DirectionalLight(),
  fill = new THREE.DirectionalLight(0xcfe4e8, .30);
scene.add(sky, sun, fill);
fill.position.set(6, 8, -8);
sun.castShadow = !small;
if (gl) {
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -11,
    right: 11,
    top: 12,
    bottom: -10,
    near: .2,
    far: 45
  });
  sun.shadow.normalBias = .026;
  sun.shadow.bias = -.00035;
}
const target = V(-.2, 3.35, -.15),
  direction = V(.50, .70, 1).normalize(),
  camera = new THREE.OrthographicCamera(-12, 12, 9, -9, .1, 150);
camera.position.copy(target).addScaledVector(direction, 29);
camera.lookAt(target);
camera.updateMatrixWorld();
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.copy(target);
Object.assign(orbit, {
  enableDamping: true,
  dampingFactor: .096,
  enablePan: false,
  minZoom: .65,
  maxZoom: 4.6,
  minPolarAngle: .30,
  maxPolarAngle: 1.40,
  rotateSpeed: .66,
  zoomSpeed: .90
});
orbit.update();
const targets = [],
  byId = new Map(),
  actions = new WeakMap();
const register = (id, obj, anchor, {
  marker = true
} = {}) => {
  targets.push(obj);
  actions.set(obj, id);
  if (!marker) return;
  if (!byId.has(id)) byId.set(id, {
    id,
    anchor: anchor.clone(),
    button: null
  });
};
const [assets, rockTextures] = await Promise.all([
  loadCourtyardModels(low),
  loadRockTextures(renderer.isSoftware ? 1 : Math.min(4, renderer.capabilities.getMaxAnisotropy()))
]);
const ctx = {
    scene: world,
    low,
    register,
    assets,
    rockTextures
  },
  garden = buildGarden(ctx),
  house = buildHouse(ctx),
  tree = buildTree(ctx);
world.updateMatrixWorld(true);
const petals = buildPetals(world, tree, garden, house, low),
  models = [tree, house, garden, petals],
  sound = createSound();
// Point lights live at world coordinates; the fallback samples their current position too.
const lake = buildLake({
  renderer,
  scene,
  camera,
  canvas: $('#water'),
  software: !gl
});
let elapsed = 0,
  now = 0,
  tween = null,
  lastAnchor = null,
  practiceEnd = 0,
  toastUntil = 0;

function measure() {
  world.updateMatrixWorld(true);
  camera.updateMatrixWorld();
  const bound = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    },
    p = V(),
    m = new THREE.Matrix4();
  const push = () => {
    bound.minX = Math.min(bound.minX, p.x);
    bound.maxX = Math.max(bound.maxX, p.x);
    bound.minY = Math.min(bound.minY, p.y);
    bound.maxY = Math.max(bound.maxY, p.y);
  };
  world.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes.position || o.material.colorWrite === false || o.name ===
      'Drifting peach petals') return;
    m.multiplyMatrices(camera.matrixWorldInverse, o.matrixWorld);
    if (o.isInstancedMesh) {
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox,
        instance = new THREE.Matrix4(),
        combined = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, instance);
        combined.multiplyMatrices(m, instance);
        for (const x of [b.min.x, b.max.x])
          for (const y of [b.min.y, b.max.y])
            for (const z of [b.min.z, b.max.z]) {
              p.set(x, y, z).applyMatrix4(combined);
              push();
            }
      }
    } else {
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        p.fromBufferAttribute(a, i).applyMatrix4(m);
        push();
      }
    }
  });
  return bound;
}
const bounds = measure();

function overviewView() {
  const w = innerWidth,
    h = innerHeight,
    mobile = w <= 650;
  const x0 = mobile ? .025 : .24,
    x1 = .965,
    y0 = mobile ? .19 : .12,
    y1 = mobile ? .86 : .85;
  const unit = Math.min(w * (x1 - x0) / (bounds.maxX - bounds.minX), h * (y1 - y0) / (bounds.maxY - bounds
    .minY));
  const sx = w / unit,
    sy = h / unit;
  const cx = (bounds.minX + bounds.maxX) / 2 + (.5 - (x0 + x1) / 2) * sx,
    cy = (bounds.minY + bounds.maxY) / 2 + ((y0 + y1) / 2 - .5) * sy;
  return {
    p: target.clone().addScaledVector(direction, 29),
    a: target.clone(),
    left: cx - sx / 2,
    right: cx + sx / 2,
    top: cy + sy / 2,
    bottom: cy - sy / 2
  };
}

function applyView(v) {
  camera.position.copy(v.p);
  orbit.target.copy(v.a);
  for (const k of ['left', 'right', 'top', 'bottom']) camera[k] = v[k];
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  orbit.update();
}

function go(v, immediate = false) {
  if (immediate || reduced) {
    tween = null;
    applyView(v);
    return;
  }
  tween = {
    start: performance.now(),
    from: {
      p: camera.position.clone(),
      a: orbit.target.clone(),
      left: camera.left / camera.zoom,
      right: camera.right / camera.zoom,
      top: camera.top / camera.zoom,
      bottom: camera.bottom / camera.zoom
    },
    to: v
  };
  camera.zoom = 1;
}
const focusSpecs = {
  relations: [.48, 1.65, 2.8, 4.3],
  study: [.1, .37, 2.7, 3.3],
  sleep: [.2, .3, 2.6, 3.6],
  practice: [.65, .94, 2.5, 3.7],
  healing: [.9, .85, 2.5, 4.4]
};

function focus(id, anchor, immediate = false) {
  const s = focusSpecs[id],
    mobile = innerWidth <= 650,
    sy = s[3] * (mobile ? 1.20 : 1),
    sx = sy * innerWidth / innerHeight,
    cx = mobile ? 0 : -sx * .15,
    cy = mobile ? -sy * .15 : 0,
    a = anchor.clone();
  const p = a.clone().addScaledVector(V(s[0], s[1], s[2]).normalize(), 18);
  go({
    p,
    a,
    left: cx - sx / 2,
    right: cx + sx / 2,
    top: cy + sy / 2,
    bottom: cy - sy / 2
  }, immediate);
}

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.05 : 1.65));
  renderer.setSize(innerWidth, innerHeight);
  lake.resize(innerWidth, innerHeight);
  if (selected) focus(selected, lastAnchor, true);
  else go(overviewView(), true);
  lake.invalidate();
}
const lighting = [
  ['#fff7e9', '#aabbb6', 1.70, '#ffe9c7', 2.0, [-7, 13, 8]],
  ['#ead8dc', '#9294ac', 1.35, '#ffc28e', 2.50, [-11, 5, 3]],
  ['#b6cbe4', '#6d8295', .99, '#c7ddff', 1.38, [5, 11, -5]]
];

function setMode(i) {
  mode = i;
  const l = lighting[i];
  sky.color.set(l[0]);
  sky.groundColor.set(l[1]);
  sky.intensity = l[2];
  sun.color.set(l[3]);
  sun.intensity = l[4];
  sun.position.set(...l[5]);
  document.body.classList.toggle('night', i === 2);
  models.forEach(m => m.setTime(i));
  lake.setTime(i);
  renderer.shadowMap.needsUpdate = true;
  if (renderer.isSoftware) renderer.cachedKey = '';
  document.querySelectorAll('#times button').forEach((b, j) => {
    b.classList.toggle('active', i === j);
    b.setAttribute('aria-pressed', String(i === j));
  });
}

function toast(text) {
  $('#status').textContent = text;
  $('#status').classList.add('show');
  toastUntil = now + 2;
}

function perform(id) {
  models.forEach(m => m.act?.(id));
  sound.act(id);
  if (id === 'tree') petals.burst();
  if (id === 'healing') {
    const p = byId.get(id).anchor;
    lake.ripple(p.x + .4, p.z + 1.7, elapsed);
  }
  if (id === 'practice' || id === 'sleep' || id.startsWith('door-')) lake.invalidate();
  if (renderer.isSoftware) renderer.cachedKey = '';
}

function select(id, anchor) {
  dismiss();
  perform(id);
  if (!places[id] || pure) {
    if (id === 'cup' && !pure) toast(tr('花盏顺水而行', 'The cup follows the stream'));
    return;
  }
  selected = id;
  tab = 0;
  practiceEnd = 0;
  lastAnchor = (anchor ?? byId.get(id).anchor).clone();
  document.body.classList.add('in-detail');
  $('#detail').hidden = false;
  focus(id, lastAnchor);
  panel();
}

function overview() {
  selected = '';
  practiceEnd = 0;
  $('#entry video')?.pause();
  $('#entry').replaceChildren();
  $('#detail').hidden = true;
  document.body.classList.remove('in-detail');
  go(overviewView());
}

function immersive() {
  pure = !pure;
  document.body.classList.toggle('pure', pure);
  $('#leave-pure').hidden = !pure;
  $('#pure').setAttribute('aria-pressed', String(pure));
  if (pure && selected) overview();
  dismiss();
}
const tabNames = [
  ['开示', 'Teaching'],
  ['短片', 'Film'],
  ['文章', 'Essay'],
  ['实修', 'Practice']
];

function panel() {
  if (!selected) return;
  const p = places[selected];
  $('#area').textContent = p.area[language];
  $('#detail-title').textContent = p.name[language];
  $('#desc').textContent = p.intro[language];
  $('#back').innerHTML = icon('back') + tr('全岛', 'Island');
  $('#back').setAttribute('aria-label', tr('返回岛屿全景', 'Return to island overview'));
  $('#tabs').replaceChildren();
  tabNames.forEach((l, i) => {
    const b = document.createElement('button');
    b.textContent = l[language];
    b.classList.toggle('active', tab === i);
    b.setAttribute('aria-pressed', String(i === tab));
    b.onclick = () => {
      tab = i;
      practiceEnd = 0;
      panel();
    };
    $('#tabs').append(b);
  });
  const e = $('#entry');
  e.replaceChildren();
  const add = (tag, text) => {
    const n = document.createElement(tag);
    n.textContent = text;
    e.append(n);
    return n;
  };
  if (tab === 0) {
    add('blockquote', tr('「', '“') + p.quote[language] + tr('」', '”'));
    const a = add('a', tr('《佛遗教经》节选 ↗', 'Sutra of the Bequeathed Teaching ↗'));
    a.href = scripture;
    a.target = '_blank';
    a.rel = 'noopener';
  }
  if (tab === 1) {
    const v = document.createElement('video');
    v.controls = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.src = globalThis.ISLE_MEDIA?.[selected + '.mp4'] ?? new URL(`../media/${selected}.mp4`, import.meta.url).href;
    v.setAttribute('aria-label', p.film[language]);
    e.append(v);
    add('small', p.film[language] + tr(' · 原创无声短片', ' · Original silent film'));
  }
  if (tab === 2) {
    add('h3', p.title[language]);
    p.article[language].forEach(t => add('p', t));
  }
  if (tab === 3) {
    add('p', p.practice[language]);
    const c = add('div', '');
    c.id = 'practice-clock';
    c.className = 'practice-time';
    const b = add('button', tr('静坐 30 秒', 'Sit for 30 seconds'));
    b.className = 'practice-btn';
    b.onclick = () => {
      if (practiceEnd) {
        practiceEnd = 0;
        panel();
      } else {
        practiceEnd = performance.now() + 30000;
        b.textContent = tr('结束', 'Finish');
        c.textContent = '0:30';
      }
    };
  }
  $('#repeat').innerHTML = icon('again') + p.action[language];
  $('#detail').scrollTop = 0;
}

function chrome() {
  $('#times').replaceChildren();
  [
    ['白天', 'Day'],
    ['黄昏', 'Dusk'],
    ['夜晚', 'Night']
  ].forEach((l, i) => {
    const b = document.createElement('button');
    b.className = i === mode ? 'active' : '';
    b.setAttribute('aria-pressed', String(i === mode));
    b.innerHTML = icon(['day', 'dusk', 'night'][i]) + '<span>' + l[language] + '</span>' + (i ?
      '<small>' + ['', '18:00', '22:00'][i] + '</small>' : '');
    b.title = l[language] + ['', ' 18:00', ' 22:00'][i];
    b.onclick = () => setMode(i);
    $('#times').append(b);
  });
  for (const [id, name, zh, en] of [
      ['reset', 'reset', '复位', 'Reset'],
      ['pure', 'pure', '纯享', 'Immerse']
    ]) {
    const b = $('#' + id);
    b.innerHTML = icon(name) + '<span>' + tr(zh, en) + '</span>';
    b.title = id === 'reset' ? tr('视角复位', 'Reset view') : tr('纯享模式', 'Immersive view');
    b.setAttribute('aria-label', b.title);
  }
  $('#leave-pure').innerHTML = icon('pure') + tr('退出纯享', 'Exit immersive view');
  $('#guide').innerHTML = icon('drag') + tr('拖动环看 · 滚轮缩放 · 点物入境',
    'Drag to orbit · Scroll to zoom · Tap to explore');
  $('#lang').textContent = tr('EN', '中');
  $('#lang').setAttribute('aria-label', tr('Switch to English', '切换至中文'));
  $('#sound i').innerHTML = icon(audible ? 'sound' : 'quiet');
  const st = audible ? tr('声音开', 'Sound on') : tr('声音关', 'Sound off');
  $('#sound span').textContent = st;
  $('#sound').setAttribute('aria-label', st);
  $('#sound').setAttribute('aria-pressed', String(audible));
  $('h1').textContent = tr('桃花岛', 'Peach Blossom Isle');
  $('.side-verse').textContent = tr('水随缘流，花随缘开。', 'Water flows. Blossoms open.');
  $('.latin').innerHTML = tr('PEACH BLOSSOM<br>ISLE', '桃花岛');
  document.documentElement.lang = language ? 'en' : 'zh-CN';
  document.body.classList.toggle('english', !!language);
  stage.setAttribute('aria-label', tr('桃花岛三维庭院', 'Interactive Peach Blossom Isle'));
  byId.forEach(p => {
    p.button.querySelector('.tag').textContent = labels[p.id][language];
    p.button.setAttribute('aria-label', labels[p.id][language]);
  });
  panel();
}
for (const [id, p] of byId) {
  const b = document.createElement('button');
  b.className = 'marker';
  b.innerHTML = '<span class="pin"></span><span class="tag"></span>';
  b.onclick = () => select(id, p.anchor);
  p.button = b;
  $('#markers').append(b);
}
$('#reset').onclick = () => {
  overview();
  toast(tr('已返回全景', 'Island overview'));
};
$('#pure').onclick = $('#leave-pure').onclick = immersive;
$('#back').onclick = overview;
$('#repeat').onclick = () => perform(selected);
$('#lang').onclick = () => {
  language = 1 - language;
  chrome();
};
$('#sound').onclick = async () => {
  try {
    audible = await sound.toggle();
    chrome();
  } catch {
    toast(tr('此设备暂时无法播放声音', 'Audio is unavailable on this device'));
  }
};
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (pure) immersive();
    else overview();
  }
  if (![stage, document.body, renderer.domElement].includes(e.target)) return;
  if (e.key === 'Home') {
    overview();
    return;
  }
  if (['+', '=', '-'].includes(e.key)) {
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * (e.key === '-' ? .9 : 1.1), orbit.minZoom, orbit
      .maxZoom);
    camera.updateProjectionMatrix();
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const d = camera.position.clone().sub(orbit.target);
    d.applyAxisAngle(V(0, 1, 0), e.key === 'ArrowLeft' ? -.13 : .13);
    camera.position.copy(orbit.target).add(d);
    orbit.update();
  }
});
const ray = new THREE.Raycaster(),
  pointer = new THREE.Vector2(),
  plane = new THREE.Plane(V(0, 1, 0), 0),
  intersect = V(),
  treeRoot = targets.find(o => actions.get(o) === 'tree'),
  treeBounds = new THREE.Box3().setFromObject(treeRoot);
let down = null,
  active = new Set(),
  hover = null,
  lastHover = 0;

function dismiss() {
  hover = null;
  $('#tooltip').hidden = true;
  stage.style.cursor = 'grab';
}
orbit.addEventListener('start', () => {
  tween = null;
  dismiss();
  if (renderer.isSoftware) {
    renderer.interacting = true;
    renderer.setSize(innerWidth, innerHeight);
  }
});
orbit.addEventListener('end', () => {
  if (renderer.isSoftware) {
    renderer.interacting = false;
    renderer.setSize(innerWidth, innerHeight);
  }
});

function hit(e) {
  pointer.set(2 * e.clientX / innerWidth - 1, 1 - 2 * e.clientY / innerHeight);
  ray.setFromCamera(pointer, camera);
  const list = !ray.ray.intersectsBox(treeBounds) ? targets.filter(o => o !== treeRoot) : targets;
  const h = ray.intersectObjects(list, true)[0];
  if (h) {
    let o = h.object;
    while (o && !actions.has(o)) o = o.parent;
    const id = o && actions.get(o);
    if (id) return {
      id,
      pos: id === 'healing' && h.point.z < 1 ? h.point : byId.get(id)?.anchor ?? h.point
    };
  }
  if (ray.ray.intersectPlane(plane, intersect) && Math.hypot(intersect.x, intersect.z) > garden.shoreRadius(
      Math.atan2(intersect.z, intersect.x))) return {
    id: 'lake',
    pos: intersect
  };
  return null;
}
stage.addEventListener('pointerdown', e => {
  active.add(e.pointerId);
  if (active.size === 1) down = {
    x: e.clientX,
    y: e.clientY,
    moved: false,
    t: performance.now()
  };
  else if (down) down.moved = true;
  dismiss();
});
stage.addEventListener('pointermove', e => {
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
  if (!down && !pure && e.pointerType === 'mouse') hover = e;
});
stage.addEventListener('pointerleave', dismiss);
stage.addEventListener('pointercancel', () => {
  active.clear();
  down = null;
});
stage.addEventListener('pointerup', e => {
  active.delete(e.pointerId);
  const tap = down && !down.moved && performance.now() - down.t < 700;
  down = null;
  if (!tap) return;
  const h = hit(e);
  if (h?.id === 'lake') {
    lake.ripple(h.pos.x, h.pos.z, elapsed);
    sound.act('lake');
  } else if (h) select(h.id, h.pos);
});
const point = V();

function pins() {
  if (pure || selected) return;
  const used = [];
  for (const id of ['relations', 'sleep', 'study', 'practice', 'healing', 'cup', 'tree']) {
    const p = byId.get(id);
    point.copy(p.anchor).project(camera);
    let x = (point.x * .5 + .5) * innerWidth,
      y = (.5 - point.y * .5) * innerHeight;
    const b = p.button;
    b.hidden = point.z < -1 || point.z > 1 || x < 12 || x > innerWidth - 12 || y < 60 || y > innerHeight - 60;
    if (b.hidden) continue;
    for (let j = 0; j < 5; j++) {
      const o = used.find(q => Math.hypot(x - q.x, y - q.y) < 30);
      if (!o) break;
      y += y < o.y ? -20 : 20;
    }
    used.push({
      x,
      y
    });
    b.style.transform = 'translate(' + Math.round(x - 19.5) + 'px,' + Math.round(y - 19.5) + 'px)';
    b.classList.toggle('invite', id === 'relations' && now < 11);
  }
}
let last = performance.now(),
  loaded = false,
  lastDoorMirror = -1;

function frame(stamp) {
  requestAnimationFrame(frame);
  if (document.hidden) {
    last = stamp;
    return;
  }
  const dt = Math.min(.07, Math.max(0, (stamp - last) / 1000));
  last = stamp;
  now += dt;
  elapsed += dt * (reduced ? .35 : 1);
  if (tween) {
    const u = Math.min(1, (stamp - tween.start) / 1050),
      a = u * u * (3 - 2 * u);
    camera.position.lerpVectors(tween.from.p, tween.to.p, a);
    orbit.target.lerpVectors(tween.from.a, tween.to.a, a);
    for (const k of ['left', 'right', 'top', 'bottom']) camera[k] = THREE.MathUtils.lerp(tween.from[k], tween
      .to[k], a);
    camera.updateProjectionMatrix();
    if (u >= 1) tween = null;
  }
  orbit.update();
  models.forEach(m => m.update(elapsed, dt * (reduced ? .35 : 1)));
  if (house.doorsChanged) {
    renderer.shadowMap.needsUpdate = true;
    if (now - lastDoorMirror > .22) {
      lake.invalidate();
      lastDoorMirror = now;
    }
  }
  sound.update(elapsed);
  camera.updateMatrixWorld();
  lake.update(elapsed);
  renderer.render(scene, camera);
  pins();
  if (hover && now - lastHover > .15) {
    const e = hover;
    hover = null;
    lastHover = now;
    const h = hit(e),
      t = $('#tooltip');
    if (h && h.id !== 'lake') {
      t.textContent = labels[h.id][language];
      t.hidden = false;
      t.style.left = Math.min(e.clientX + 15, innerWidth - t.offsetWidth - 5) + 'px';
      t.style.top = Math.max(5, e.clientY - 30) + 'px';
      stage.style.cursor = 'pointer';
    } else dismiss();
  }
  if (toastUntil && now > toastUntil) {
    toastUntil = 0;
    $('#status').classList.remove('show');
  }
  if (practiceEnd) {
    const left = Math.max(0, Math.ceil((practiceEnd - performance.now()) / 1000)),
      c = $('#practice-clock');
    if (c) c.textContent = left ? '0:' + String(left).padStart(2, '0') : tr('练习结束', 'Practice complete');
    if (!left) {
      practiceEnd = 0;
      if ($('.practice-btn')) $('.practice-btn').textContent = tr('再坐 30 秒', 'Sit again');
    }
  }
  if (!loaded) {
    loaded = true;
    $('#loading').classList.add('done');
    setTimeout(() => $('#loading').hidden = true, 450);
  }
}
resize();
setMode(0);
chrome();
window.addEventListener('resize', resize);
requestAnimationFrame(frame);

}
boot().catch(error => {
  console.error(error);
  document.querySelector("#loading p").textContent = "入岛暂未完成，请刷新重试";
});
