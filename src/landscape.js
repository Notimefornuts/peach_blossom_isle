import * as THREE from '../vendor/three.module.js';
import { buildStonePaving, insideStone } from './paving.js';

const TAU = Math.PI * 2;
const GROUND = .85;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function shoreRadius(angle) {
  const ellipse = 1 / Math.hypot(Math.cos(angle) / 6.1, Math.sin(angle) / 4.5);
  const original = ellipse * (1 + .065 * Math.sin(angle * 3 + .8) + .042 * Math.cos(angle * 5 + .5) +
    .026 * Math.sin(angle * 8 - 1.3) + .012 * Math.cos(angle * 13));
  return original + .68 * Math.abs(Math.cos(angle)) ** 3 + 1.45 * Math.max(0, Math.sin(angle)) ** 2;
}

function crestHeight(angle) {
  return .57 + .13 * Math.sin(angle * 3 - .4) + .065 * Math.cos(angle * 7 + .5);
}

export function groundHeight(x, z) {
  const angle = Math.atan2(z, x);
  const distance = shoreRadius(angle) - Math.hypot(x, z);
  const slope = THREE.MathUtils.smoothstep(distance, 0, .66);
  return THREE.MathUtils.lerp(crestHeight(angle), GROUND, slope);
}

function geometry(positions, indices, colors, uv) {
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setIndex(indices);
  if (colors) result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (uv) result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  result.computeVertexNormals();
  return result;
}

// Shared weathered profiles have broad faces, broken corners and sloping shoulders.
function rockGeometry(seed, slab = false) {
  const random = seeded(seed);
  const sides = 7;
  const outline = Array.from({
    length: sides
  }, (_, i) => ({
    angle: i * TAU / sides + (random() - .5) * .15,
    radius: .77 + random() * .23
  }));
  const positions = [],
    indices = [];
  const rings = slab ? [
    [.83, -.5],
    [1, .03],
    [.90, .43],
    [.25, .5]
  ] : [
    [.68, -.5],
    [.99, -.19],
    [1, .10],
    [.72, .43],
    [.22, .51]
  ];
  for (const [scale, y] of rings) {
    for (const p of outline) {
      positions.push(Math.cos(p.angle) * p.radius * scale + y * .10,
        y + (slab ? .015 : .045) * random(), Math.sin(p.angle) * p.radius * scale);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < sides; i++) {
      const a = ring * sides + i,
        b = ring * sides + (i + 1) % sides;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  const top = (rings.length - 1) * sides;
  for (let i = 1; i < sides - 1; i++) indices.push(top, top + i + 1, top + i);
  const result = geometry(positions, indices).toNonIndexed();
  result.computeVertexNormals();
  return result;
}

function leafInto(positions, indices, base, tip, width, roll = 0) {
  const axis = tip.clone().sub(base);
  const side = new THREE.Vector3(-axis.z, 0, axis.x).normalize();
  if (side.lengthSq() < .01) side.set(Math.cos(roll), 0, Math.sin(roll));
  side.applyAxisAngle(axis.clone().normalize(), roll);
  const middle = base.clone().lerp(tip, .52);
  const left = middle.clone().addScaledVector(side, width);
  const right = middle.clone().addScaledVector(side, -width);
  const ridge = middle.clone().add(new THREE.Vector3(0, width * .39, 0));
  const start = positions.length / 3;
  for (const p of [base, left, tip, right, ridge]) positions.push(...p.toArray());
  indices.push(start, start + 1, start + 4, start + 1, start + 2, start + 4,
    start + 2, start + 3, start + 4, start + 3, start, start + 4);
}

function twigInto(positions, indices, base, tip, radius) {
  const axis = tip.clone().sub(base).normalize();
  const right = new THREE.Vector3(0, 0, 1).cross(axis).normalize();
  const forward = axis.clone().cross(right).normalize();
  const start = positions.length / 3;
  for (const [center, width] of [
      [base, radius],
      [tip, radius * .32]
    ]) {
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const p = center.clone().addScaledVector(right, Math.cos(angle) * width)
        .addScaledVector(forward, Math.sin(angle) * width);
      positions.push(...p.toArray());
    }
  }
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    indices.push(start + i, start + next, start + i + 4,
      start + next, start + next + 4, start + i + 4);
  }
}

function shrubGeometry(seed) {
  const random = seeded(seed),
    positions = [],
    indices = [];
  for (let branch = 0; branch < 8; branch++) {
    const angle = branch * 2.39996 + random() * .35;
    const height = .52 + random() * .46;
    const spread = .28 + random() * .27;
    twigInto(positions, indices, V(0, 0, 0),
      V(Math.cos(angle) * spread, height, Math.sin(angle) * spread), .008);
    for (let i = 0; i < 6; i++) {
      const t = .19 + i * .14;
      const center = V(Math.cos(angle) * spread * t, height * t,
        Math.sin(angle) * spread * t);
      for (const side of [-1, 1]) {
        const outward = angle + side * (.62 + .15 * random());
        const length = .14 + .11 * random();
        const tip = center.clone().add(V(Math.cos(outward) * length,
          .055 + random() * .06, Math.sin(outward) * length));
        leafInto(positions, indices, center, tip, length * (.25 + random() * .15));
      }
    }
  }
  return geometry(positions, indices);
}

function rosetteGeometry(seed, fern = false) {
  const random = seeded(seed),
    positions = [],
    indices = [];
  for (let frond = 0; frond < 8; frond++) {
    const angle = frond * 2.39996 + random() * .4;
    const length = .48 + random() * .43;
    const end = V(Math.cos(angle) * length * .61, .24 + random() * .28,
      Math.sin(angle) * length * .61);
    if (!fern) {
      leafInto(positions, indices, V(0, .012, 0), end, length * .17);
      continue;
    }
    let previous = V(0, 0, 0);
    for (let segment = 1; segment <= 8; segment++) {
      const u = segment / 8;
      const point = end.clone().multiplyScalar(u);
      point.y += Math.sin(u * Math.PI) * .22;
      twigInto(positions, indices, previous, point, .006 * (1 - u * .65));
      previous = point;
    }
    for (let j = 1; j <= 9; j++) {
      const u = j / 10;
      const base = end.clone().multiplyScalar(u);
      base.y += Math.sin(u * Math.PI) * .22;
      const reach = .15 * Math.sin(u * Math.PI) + .018;
      for (const side of [-1, 1]) {
        const tip = base.clone().add(V(Math.cos(angle + side * 1.25) * reach,
          .017, Math.sin(angle + side * 1.25) * reach));
        leafInto(positions, indices, base, tip, reach * .16);
      }
    }
  }
  return geometry(positions, indices);
}

function bloomGeometry() {
  const positions = [],
    indices = [];
  for (let petal = 0; petal < 5; petal++) {
    const angle = petal / 5 * TAU;
    const start = positions.length / 3;
    positions.push(0, .07, 0);
    for (let k = 0; k < 7; k++) {
      const a = k / 6 * TAU;
      const x = .46 + .45 * Math.cos(a),
        z = .30 * Math.sin(a);
      positions.push(Math.cos(angle) * x - Math.sin(angle) * z,
        .16 * Math.sin(k / 6 * Math.PI), Math.sin(angle) * x + Math.cos(angle) * z);
      if (k) indices.push(start, start + k + 1, start + k);
    }
  }
  return geometry(positions, indices);
}

export function buildLandscape({
  root,
  low,
  put,
  beam,
  shapes,
  channelSides,
  channelPoints,
  channelOutline,
  courtyard
}) {
  const random = seeded(208816);
  const range = (a, b) => a + random() * (b - a);
  const choose = values => values[Math.floor(random() * values.length)];
  const leafColors = ['#76976c', '#88a774', '#a1b97e', '#afc58e', '#7ea381', '#b6c695'];
  const rockColors = ['#8e9a91', '#9fa797', '#7f908a', '#aab0a0', '#8f9b8b', '#a8ad99'];
  const mossColors = ['#708960', '#8d9f6c', '#9caa76', '#7f995f', '#a6b47b'];
  for (let i = 0; i < 5; i++) {
    shapes['bankRock' + i] = rockGeometry(314 + i * 17);
    shapes['pathSlab' + i] = rockGeometry(119 + i * 23, true);
  }
  for (let i = 0; i < 3; i++) shapes['shrub' + i] = shrubGeometry(88 + i * 27);
  shapes.rosette = rosetteGeometry(72);
  shapes.fern = rosetteGeometry(438, true);
  shapes.gardenBloom = bloomGeometry();
  const vinePositions = [],
    vineIndices = [];
  leafInto(vinePositions, vineIndices, V(0, 0, 0), V(.03, -.17, .045), .057);
  shapes.vineLeaf = geometry(vinePositions, vineIndices);

  // A flat inhabited centre meets a sloping, uneven rim, then eroded earth and water.
  const segments = 208;
  const inner = Array.from({
    length: segments
  }, (_, i) => {
    const angle = i / segments * TAU,
      radius = shoreRadius(angle) - .67;
    return V(Math.cos(angle) * radius, GROUND, Math.sin(angle) * radius);
  });
  const hole = channelOutline ?? [...channelSides[0], ...channelSides[1].slice().reverse()];
  const coordinates = [...inner, ...hole],
    positions = [],
    uv = [];
  for (const p of coordinates) {
    positions.push(p.x, GROUND, p.z);
    uv.push(p.x / 3.5, p.z / 3.5);
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#a7b08b';
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 650; i++) {
    const x = random() * 256,
      y = random() * 256,
      radius = range(3, 28);
    const wash = context.createRadialGradient(x, y, 0, x, y, radius);
    wash.addColorStop(0, choose(['#6e8b674d', '#c4bf984d', '#8097614d', '#e1d0a129']));
    wash.addColorStop(1, '#ffffff00');
    context.fillStyle = wash;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const flat = p => new THREE.Vector2(p.x, p.z);
  const faces = THREE.ShapeUtils.triangulateShape(inner.map(flat), [hole.map(flat)]);
  const turf = new THREE.Mesh(geometry(positions, faces.flatMap(([a, b, c]) => [c, b, a]), null, uv),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1,
      side: THREE.DoubleSide
    }));
  turf.name = 'Moss and earth of the inner garden';
  turf.receiveShadow = true;
  root.add(turf);

  const bandPositions = [],
    bandIndices = [],
    bandColors = [],
    tint = new THREE.Color();
  for (let level = 0; level < 6; level++) {
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * TAU;
      const crest = crestHeight(angle);
      const inset = [.03, -.09, .025, 0, .33, .67][level];
      const radius = shoreRadius(angle) - inset;
      const heights = [-.15, .055, crest * .46, crest, (crest + GROUND) * .5, GROUND];
      const y = heights[level] + (level < 3 ? .025 * Math.sin(angle * 16 + level) : 0);
      bandPositions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      tint.set(['#637d78', '#7f8d7f', '#a09a80', '#989d78', '#97a779', '#a7b08b'][level]);
      tint.multiplyScalar(.92 + .065 * Math.sin(angle * 11 + .6));
      bandColors.push(tint.r, tint.g, tint.b);
      if (level) {
        const a = (level - 1) * segments + i;
        const b = (level - 1) * segments + (i + 1) % segments;
        bandIndices.push(a, a + segments, b, b, a + segments, b + segments);
      }
    }
  }
  const bank = new THREE.Mesh(geometry(bandPositions, bandIndices, bandColors),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide
    }));
  bank.name = 'Sloping banks and exposed soil';
  bank.castShadow = bank.receiveShadow = true;
  root.add(bank);

  function coastalRock(x, z, size, height, rotation) {
    const y = height * .33;
    const kind = 'bankRock' + Math.floor(random() * 5);
    put(kind, x, y, z, size, height, size * range(.63, .98), choose(rockColors),
      range(-.10, .10), rotation, range(-.12, .12));
    if (random() < .82) {
      put(kind, x + .025, y + height * .36, z - .02, size * .78, height * .14,
        size * .64, choose(mossColors), 0, rotation);
    }
  }
  // Separated outcrops and broad shoulders alternate with low planted banks.
  const headlands = [-.32, .29, .78, 1.78, 2.28, 2.85, 3.43, 4.02, 4.78, 5.48];
  for (const angle of headlands) {
    const radius = shoreRadius(angle);
    const size = range(.47, .72);
    coastalRock(Math.cos(angle) * radius, Math.sin(angle) * radius, size, range(.72, 1.11), angle);
    for (let j = 0; j < 5; j++) {
      const a = angle + range(-.19, .19),
        r = shoreRadius(a) + range(-.16, .24);
      coastalRock(Math.cos(a) * r, Math.sin(a) * r, size * range(.28, .63), range(.26, .60), a);
    }
  }
  for (let i = 0; i < 50; i++) {
    const angle = random() * TAU,
      radius = shoreRadius(angle) + range(-.12, .18);
    coastalRock(Math.cos(angle) * radius, Math.sin(angle) * radius, range(.10, .21), range(.12, .27), angle);
  }

  const paths = courtyard.paths;
  const {forecourt} = courtyard, paving=[];
  function pavingStone(kind,x,y,z,sx,sy,sz,tint,angle=0,tilt=0){
    put(kind,x,y,z,sx,sy,sz,tint,tilt,angle,-tilt*.65);
    paving.push({x,z,across:sx*.84,along:sz*.84,angle,top:y+sy*.50});
  }
  // An embedded mortar/earth bed makes each route one continuous dry surface.
  // Its vertices follow the existing ground; it does not create raised pads.
  const bedPoints=[],bedIndices=[];
  for(const path of paths){
    const steps=Math.ceil(path.curve.getLength()/.18),start=bedPoints.length/3;
    for(let i=0;i<=steps;i++){
      const u=i/steps,p=path.curve.getPointAt(u),t=path.curve.getTangentAt(u);
      for(const sign of[-1,1]){
        const x=p.x-t.z*sign*path.width/2,z=p.z+t.x*sign*path.width/2;
        bedPoints.push(x,groundHeight(x,z)+.004,z);
      }
      if(i<steps){const k=start+i*2;bedIndices.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
  }
  const pathBed=new THREE.Mesh(geometry(bedPoints,bedIndices),new THREE.MeshStandardMaterial({
    color:'#b7bba0',roughness:1,side:THREE.DoubleSide}));
  pathBed.name='Continuous grounded courtyard paths';pathBed.receiveShadow=true;root.add(pathBed);

  const seeds=[];
  for(let row=0;row<2;row++)for(let col=0;col<4;col++){
    const x=forecourt.minX+(col+.5)*(forecourt.maxX-forecourt.minX)/4;
    const z=forecourt.minZ+(row+.5)*(forecourt.maxZ-forecourt.minZ)/2;
    seeds.push({x:x+range(-.04,.04),z:z+range(-.025,.025),polygon:[
      [forecourt.minX,forecourt.minZ],[forecourt.maxX,forecourt.minZ],
      [forecourt.maxX,forecourt.maxZ],[forecourt.minX,forecourt.maxZ]]});
  }
  // The bridge's stone treads sit just outside the imported timber footprint.
  // Deep embedded bases accommodate the unchanged sloping island shoulder.
  const bridge=courtyard.bridge;
  bridge.landings=[];
  for(const sign of[-1,1]){
    const p=bridge.center.clone().addScaledVector(bridge.axis,sign*(bridge.length/2+.18));
    const angle=Math.atan2(bridge.axis.x,bridge.axis.z);
    pavingStone('pathSlab2',p.x,.900,p.z,.47,.238,.19,'#b8bca5',angle);
    bridge.landings.push({x:p.x,z:p.z,top:1.019,angle});
  }
  // Two long, low solid slabs span the water from the entrance platform to
  // the meditation side. Their ends rest on land while water stays below.
  const stoneBridge=courtyard.stoneBridge, stoneBridgeTop=.958;
  const stoneGroup=new THREE.Group();stoneGroup.name='Stone slab bridge';root.add(stoneGroup);
  for(const side of[-1,1]){
    const a=stoneBridge.axis,normal=V(-a.z,0,a.x),half=stoneBridge.length/2;
    const slabWidth=stoneBridge.width/2-.008, offset=side*(stoneBridge.width/4+.002);
    const w=slabWidth/2,chamfer=.035;
    const outline=[[-half+chamfer,-w],[half-chamfer,-w],[half,-w+chamfer],
      [half,w-chamfer],[half-chamfer,w],[-half+chamfer,w],[-half,w-chamfer],[-half,-w+chamfer]];
    const positions=[],indices=[],n=outline.length;
    for(const ring of[0,1,2])for(const [along,across] of outline){
      const inset=ring===2?.965:1;
      const p=stoneBridge.center.clone().addScaledVector(a,along*inset)
        .addScaledVector(normal,offset+across*inset);
      positions.push(p.x,ring===0?.84:ring===1?stoneBridgeTop-.018:stoneBridgeTop,p.z);
    }
    for(let ring=0;ring<2;ring++)for(let i=0;i<n;i++){
      const j=(i+1)%n,k=ring*n+i,l=ring*n+j;
      indices.push(k,k+n,l,l,k+n,l+n);
    }
    for(let i=1;i<n-1;i++)indices.push(2*n,2*n+i+1,2*n+i);
    const slab=new THREE.Mesh(geometry(positions,indices).toNonIndexed(),
      new THREE.MeshStandardMaterial({color:side<0?'#b7c1ad':'#c5c9b4',roughness:.96,side:THREE.DoubleSide}));
    slab.geometry.computeVertexNormals();slab.name='Beveled stone bridge slab';
    slab.castShadow=slab.receiveShadow=true;stoneGroup.add(slab);
  }
  const samples=paths.flatMap(path=>path.curve.getSpacedPoints(70).map(p=>({p,width:path.width})));
  function nearPath(x,z,padding=0){
    return samples.some(({p,width})=>(p.x-x)**2+(p.z-z)**2<(width*.5+padding)**2);
  }
  function nearChannel(x,z,padding=0){
    const sample=courtyard.at(x,z);return sample.distance<sample.width+padding;
  }
  for(const path of paths){
    const count=Math.ceil(path.curve.getLength()/.32);
    for(let i=0;i<=count;i++)for(const side of[-1,1]){
      const u=Math.min(1,(i+(side>0?.34:0))/count),p=path.curve.getPointAt(u),t=path.curve.getTangentAt(u);
      const nx=-t.z,nz=t.x,offset=side*path.width*.23+range(-.018,.018);
      const x=p.x+nx*offset,z=p.z+nz*offset;
      if(x>forecourt.minX+.02&&x<forecourt.maxX-.02&&z>forecourt.minZ+.02&&z<forecourt.maxZ-.02)continue;
      const polygon=[];
      for(const[a,b]of[[-.36,-path.width/2],[.36,-path.width/2],[.36,path.width/2],[-.36,path.width/2]])
        polygon.push([p.x+t.x*a+nx*b,p.z+t.z*a+nz*b]);
      seeds.push({x,z,polygon});
    }
  }
  const stonePaving=buildStonePaving({root,seeds,groundHeight,meditation:courtyard.meditation,bridge,stoneBridge});
  paving.push(...stonePaving.pavers);
  function pathSurfaceAt(x,z){
    let top=null;
    const dx=x-stoneBridge.center.x,dz=z-stoneBridge.center.z,a=stoneBridge.axis;
    if(Math.abs(dx*a.x+dz*a.z)<=stoneBridge.length/2 &&
      Math.abs(-dx*a.z+dz*a.x)<=stoneBridge.width/2)top=stoneBridgeTop+.012;
    for(const p of paving){
      if(p.polygon){if(insideStone(p.polygon,x,z))top=Math.max(top??0,p.top+.012);continue;}
      const dx=x-p.x,dz=z-p.z,c=Math.cos(p.angle),s=Math.sin(p.angle);
      if(((dx*c-dz*s)/p.across)**2+((dx*s+dz*c)/p.along)**2<1)top=Math.max(top??0,p.top+.012);
    }
    return top;
  }

  function clearForPlants(x, z, padding = .1) {
    const angle = Math.atan2(z, x);
    if (Math.hypot(x, z) > shoreRadius(angle) - .13) return false;
    if (x > -1.68 - padding && x < 4.04 + padding && z > -3.43 - padding && z < .76 + padding) return false;
    if (x > -3.86 - padding && x < -1.67 + padding && z > .51 - padding && z < 2.88 + padding) return false;
    if (Math.hypot(x - courtyard.meditation.x, z - courtyard.meditation.z) < courtyard.meditation.radius + .25 + padding || Math.hypot(x - courtyard.lantern.x, z - courtyard.lantern.z) < .42 + padding)
      return false;
    if (Math.hypot(x + 2.85, z + 1.40) < .78) return false;
    const bridge = courtyard.bridge, dx = x - bridge.center.x, dz = z - bridge.center.z;
    if (Math.abs(dx * bridge.axis.x + dz * bridge.axis.z) < bridge.length / 2 + .35 &&
      Math.abs(-dx * bridge.axis.z + dz * bridge.axis.x) < .65 + padding) return false;
    const sx=x-stoneBridge.center.x,sz=z-stoneBridge.center.z,sa=stoneBridge.axis;
    if(Math.abs(sx*sa.x+sz*sa.z)<stoneBridge.length/2+.18+padding &&
      Math.abs(-sx*sa.z+sz*sa.x)<stoneBridge.width/2+.16+padding)return false;
    if (x > forecourt.minX - .15 && x < forecourt.maxX + .15 && z > forecourt.minZ - .1 && z < forecourt.maxZ + .15) return false;
    if (x > 1.2 && x < 2.5 && z > 4.45) return false;
    return !nearPath(x, z, padding + .14) && !nearChannel(x, z, padding + .10);
  }

  // Groundcover mats follow irregular patches, with clear paths between them.
  const beds = [
    [-4.30, -.84, .83, 1.12, .62],
    [-4.36, 1.08, .72, 1.05, .54],
    [-4.20, 3.72, .60, .43, .35],
    [-2.92, 4.71, .74, .38, .33],
    [.10, 5.03, .52, .23, .25],
    [2.84, 3.98, .74, .46, .42],
    [4.28, 2.40, .60, .47, .42],
    [4.97, .53, .35, .89, .65],
    [-2.08, -2.85, .62, .63, .52],
    [-4.02, -2.57, .65, .69, .48]
  ];
  const bedAttempts = low ? 23 : 34;
  for (const [cx, cz, rx, rz, height] of beds) {
    for (let i = 0; i < bedAttempts; i++) {
      const a = random() * TAU,
        radius = Math.sqrt(random());
      const x = cx + Math.cos(a) * rx * radius,
        z = cz + Math.sin(a) * rz * radius;
      if (!clearForPlants(x, z, .11)) continue;
      const y = groundHeight(x, z),
        size = range(.16, .27);
      put('bankRock' + i % 5, x, y + .015, z, size * 1.23, .075, size,
        choose(mossColors), 0, random() * TAU);
      if (i % 3 === 0) {
        const scale = height * range(.62, 1.13);
        put('shrub' + i % 3, x, y + .012, z, range(.72, 1.08), scale,
          range(.72, 1.08), choose(leafColors), 0, random() * TAU);
      } else {
        const scale = range(.27, .51);
        put('rosette', x, y + .016, z, scale, scale * range(.70, 1.04), scale,
          choose(leafColors), 0, random() * TAU);
      }
    }
    // Each bed has a few taller stems above low, spreading leaves.
    for (let i = 0; i < (low ? 7 : 11); i++) {
      const x = cx + range(-rx * .88, rx * .88),
        z = cz + range(-rz * .82, rz * .82);
      if (!clearForPlants(x, z, .16)) continue;
      const y = groundHeight(x, z),
        h = height * range(.62, 1.06),
        end = V(x + range(-.08, .08), y + h, z);
      beam(V(x, y, z), end, .006, '#758d5d');
      for (const side of [-1, 1]) {
        put('rosette', x + side * .03, y + h * .30, z, .15, .18, .15,
          choose(leafColors), 0, random() * TAU);
      }
      put('gardenBloom', end.x, end.y, end.z, range(.055, .074), .06, range(.055, .074),
        choose(['#f5ebd8', '#f3d5d1', '#e8b3c2', '#fff0e1']), range(-.25, .25), random() * TAU);
    }
  }

  // Larger folded leaves and fern fronds make the middle layer legible from afar.
  const understorey = [
    [-4.60, -.30],
    [-4.50, .38],
    [-3.73, -.63],
    [-3.63, -2.65],
    [-2.1, -2.81],
    [-2.14, 4.90],
    [2.63, 4.12],
    [3.55, 3.90],
    [4.67, 2.10],
    [4.71, 1.32],
    [4.93, -.66],
    [-4.3, 2.50]
  ];
  for (let i = 0; i < understorey.length; i++) {
    const [x, z] = understorey[i];
    if (!clearForPlants(x, z, .32)) continue;
    put(i % 3 ? 'rosette' : 'fern', x, groundHeight(x, z) + .013, z,
      range(.73, 1.09), range(.75, 1.05), range(.73, 1.09),
      choose(leafColors), 0, random() * TAU);
  }

  for (let i = 0; i < (low ? 170 : 260); i++) {
    const angle = random() * TAU,
      distance = range(.11, .74);
    const radius = shoreRadius(angle) - distance;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    if (!clearForPlants(x, z, .045)) continue;
    const y = groundHeight(x, z),
      scale = range(.25, .58);
    put('rosette', x, y + .01, z, scale, scale * .66, scale,
      choose(leafColors), 0, random() * TAU);
    if (i % 3 === 0) put('bankRock' + i % 5, x, y + .018, z, scale * .71, .058,
      scale * .50, choose(mossColors), 0, random() * TAU);
  }

  // Ivy crosses the broken soil lip in strands of unequal length.
  for (const centerAngle of [.04, .51, .94, 1.75, 2.22, 2.84, 3.58, 4.36, 5.48, 5.87]) {
    for (let strand = 0; strand < (low ? 5 : 8); strand++) {
      const angle = centerAngle + range(-.11, .11),
        radius = shoreRadius(angle);
      const top = crestHeight(angle) + .045,
        length = range(.25, .61);
      let previous = V(Math.cos(angle) * (radius - .05), top, Math.sin(angle) * (radius - .05));
      for (let j = 0; j < 7; j++) {
        const u = (j + 1) / 7;
        const r = radius + .04 + Math.sin(u * Math.PI) * .055;
        const a = angle + .012 * Math.sin(u * 8 + strand);
        const p = V(Math.cos(a) * r, top - u * length, Math.sin(a) * r);
        beam(previous, p, .004, '#70845d');
        put('vineLeaf', p.x, p.y, p.z, range(.62, .97), range(.68, .98), .8,
          choose(leafColors), 0, a + (j % 2 ? .9 : -.9));
        previous = p;
      }
    }
  }

  // Six low, broad treads meet the path and disappear into the shallow water.
  for (let i = 0; i < 6; i++) {
    const angle = 1.24,
      radius = shoreRadius(angle) - .94 + i * .28;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    const top = GROUND + .02 - i * .145;
    put('pathSlab' + i % 5, x, top - .075, z, .65, .15, .31,
      choose(['#aeb8a2', '#bec4ad', '#9caa99']), 0, Math.PI / 2 - angle);
    if (i < 4) put('bankRock' + i % 5, x, top - .24, z, .55, .39, .28,
      '#879786', 0, Math.PI / 2 - angle);
  }
  return {
    groundHeight,
    pathSurfaceAt,
    paving,
    paths,
    nearPath,
    nearChannel
  };
}
