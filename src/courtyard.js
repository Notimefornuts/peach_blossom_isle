import * as THREE from '../vendor/three.module.js';
import { resolveCourtyardLayout, streamHalfWidth } from './courtyard-layout.js';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const WATER = .735;
export const BED = .595;
export const LAND = .85;

export function createCourtyard() {
  const layout = resolveCourtyardLayout();
  const curve = new THREE.CatmullRomCurve3(layout.stream.map(([x,z])=>V(x,WATER,z)));
  const count = 128, points = curve.getSpacedPoints(count);
  const halfWidth = streamHalfWidth;
  const sides = [[], []];
  for (let i = 0; i <= count; i++) {
    const p = points[i], t = curve.getTangentAt(i / count), n = V(-t.z, 0, t.x).normalize();
    for (const [j, sign] of [[0, 1], [1, -1]]) sides[j].push(p.clone().addScaledVector(n, sign * halfWidth(i / count)));
  }
  function outline(scale = 1, y = LAND) {
    const left = [], right = [];
    for (let i = 0; i <= count; i++) {
      const p = points[i], t = curve.getTangentAt(i / count), n = V(-t.z, 0, t.x).normalize();
      left.push(p.clone().addScaledVector(n, halfWidth(i / count) * scale).setY(y));
      right.push(p.clone().addScaledVector(n, -halfWidth(i / count) * scale).setY(y));
    }
    const result = [...left];
    for (const [u, sign] of [[1, 1], [0, -1]]) {
      const p = points[u ? count : 0], t = curve.getTangentAt(u), n = V(-t.z, 0, t.x).normalize();
      for (let i = 1; i < 12; i++) {
        const a = i * Math.PI / 12;
        result.push(p.clone().addScaledVector(n, Math.cos(a) * halfWidth(u) * scale * sign)
          .addScaledVector(t, Math.sin(a) * halfWidth(u) * scale * sign).setY(y));
      }
      if (u) result.push(...right.slice().reverse());
    }
    return result;
  }
  function at(x, z) {
    let best = Infinity, index = 0;
    for (let i = 0; i < points.length; i++) {
      const d = (x - points[i].x) ** 2 + (z - points[i].z) ** 2;
      if (d < best) { best = d; index = i; }
    }
    const u = index / count, t = curve.getTangentAt(u), n = V(-t.z, 0, t.x).normalize();
    return { u, distance: Math.sqrt(best), width: halfWidth(u), normal: n, point: points[index] };
  }
  const bridge = { center:V(layout.bridge.x,LAND,layout.bridge.z),
    length:layout.bridge.length, yaw:layout.bridge.yaw, base:layout.bridge.base,
    axis:V(layout.bridge.axis[0],0,layout.bridge.axis[1]),
    front:V(layout.bridge.front[0],LAND,layout.bridge.front[1]),
    house:V(layout.bridge.house[0],LAND,layout.bridge.house[1]) };
  const stoneBridge = { center:V(layout.stoneBridge.x,LAND,layout.stoneBridge.z),
    length:layout.stoneBridge.length, width:layout.stoneBridge.width,
    yaw:layout.stoneBridge.yaw,
    axis:V(layout.stoneBridge.axis[0],0,layout.stoneBridge.axis[1]),
    house:V(layout.stoneBridge.house[0],LAND,layout.stoneBridge.house[1]),
    garden:V(layout.stoneBridge.garden[0],LAND,layout.stoneBridge.garden[1]) };
  const paths = layout.paths.map(path=>({id:path.id,name:path.name,width:path.width,
    curve:new THREE.CatmullRomCurve3(path.points.map(([x,z])=>V(x,0,z)))}));
  return {curve,points,sides,halfWidth,outline,at,bridge,stoneBridge,paths,
    forecourt:layout.forecourt,meditation:layout.meditation,lantern:layout.lantern,
    healing:V(layout.healing.x,layout.healing.y,layout.healing.z)};
}

function meshGeometry(points, indices) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => p.toArray()), 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

export function buildCourtyardWater({root, courtyard, put, shapes}) {
  const top = courtyard.outline(1, LAND), edge = courtyard.outline(.82, WATER), bottom = courtyard.outline(.69, BED);
  const all = [...top, ...edge, ...bottom], indices = [], n = top.length;
  for (let band = 0; band < 2; band++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = band * n + i, b = band * n + j;
    indices.push(a, a + n, b, b, a + n, b + n);
  }
  const banks = new THREE.Mesh(meshGeometry(all, indices), new THREE.MeshStandardMaterial({ color: '#91a28c', roughness: .98, side: THREE.DoubleSide }));
  banks.name = 'Shallow winding stream banks'; banks.receiveShadow = true; root.add(banks);
  const faces = THREE.ShapeUtils.triangulateShape(bottom.map(p => new THREE.Vector2(p.x, p.z)), []);
  const bed = new THREE.Mesh(meshGeometry(bottom, faces.flatMap(([a,b,c])=>[c,b,a])), new THREE.MeshStandardMaterial({color:'#c1bea1',roughness:1,side:THREE.DoubleSide}));
  bed.name='Pebbled shallow stream bed'; root.add(bed);
  const waterFaces = THREE.ShapeUtils.triangulateShape(edge.map(p=>new THREE.Vector2(p.x,p.z)),[]);
  const material = new THREE.MeshStandardMaterial({color:'#69b9b2',roughness:.25,metalness:.04,transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide});
  const clock={value:0};
  material.onBeforeCompile=shader=>{
    shader.uniforms.streamTime=clock;
    shader.vertexShader='varying vec3 streamWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstreamWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='uniform float streamTime; varying vec3 streamWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat wave=sin(streamWorld.x*9.+streamWorld.z*5.+streamTime*.8);float finer=sin(streamWorld.z*17.-streamWorld.x*3.+streamTime*.55);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.70,.90,.82),.12*smoothstep(.80,1.,wave)+.045*smoothstep(.94,1.,finer));');
  };
  material.customProgramCacheKey=()=> 'courtyard-flow-v1';
  const water = new THREE.Mesh(meshGeometry(edge,waterFaces.flatMap(([a,b,c])=>[c,b,a])),material);
  water.name='Flowing courtyard water';water.renderOrder=3;root.add(water);
  const shimmer=[];
  for(let j=0;j<14;j++){
    const u=.04+j*.067,p=courtyard.curve.getPointAt(u),t=courtyard.curve.getTangentAt(u),normal=V(-t.z,0,t.x).normalize();
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(27),3));
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#d9eee0',transparent:true,opacity:.22,depthWrite:false}));line.renderOrder=4;root.add(line);shimmer.push({line,u});
    if(j%2===0)for(const sign of [-1,1]){const q=p.clone().addScaledVector(normal,sign*courtyard.halfWidth(u)*.98);put('bankRock'+j%5,q.x,LAND-.025,q.z,.13,.11,.10,'#a2ac98',0,j*.7);}
  }
  const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    Array.from({length:32},(_,i)=>V(Math.cos(i/32*Math.PI*2),0,Math.sin(i/32*Math.PI*2)))),
    new THREE.LineBasicMaterial({color:'#eff7e5',transparent:true,opacity:0,depthWrite:false}));
  ring.position.copy(courtyard.curve.getPointAt(.48)).setY(WATER+.012);ring.renderOrder=4;root.add(ring);
  let rippleStart=-10;
  return {
    material,
    ripple(){rippleStart=clock.value;},
    update(time){
      clock.value=time;
      const age=(time-rippleStart)/1.8;
      ring.visible=age>=0&&age<1;
      ring.scale.setScalar(.035+.22*Math.min(1,age));
      ring.material.opacity=.36*Math.max(0,1-age);
      for(const {line,u}of shimmer){
        const p=courtyard.curve.getPointAt(Math.min(.99,u+.009*Math.sin(time*.12+u*7))),t=courtyard.curve.getTangentAt(u),n=V(-t.z,0,t.x).normalize();
        for(let i=0;i<9;i++){
          const s=(i/8-.5)*courtyard.halfWidth(u)*1.0;
          line.geometry.attributes.position.setXYZ(i,p.x+n.x*s+t.x*.024*Math.sin(i*.8+time),WATER+.009,p.z+n.z*s+t.z*.024*Math.sin(i*.8+time));
        }
        line.geometry.attributes.position.needsUpdate=true;
      }
    }
  };
}
