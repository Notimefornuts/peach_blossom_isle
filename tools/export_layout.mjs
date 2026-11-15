import * as T from '../vendor/three.module.js';
import {resolveCourtyardLayout,streamHalfWidth} from '../src/courtyard-layout.js';
import {shoreRadius} from '../src/landscape.js';
import {writeFileSync} from 'node:fs';
const data=resolveCourtyardLayout();
const curve=points=>new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)));
const stream=curve(data.stream),left=[],right=[];
for(let i=0;i<=128;i++){
  const u=i/128,p=stream.getPointAt(u),t=stream.getTangentAt(u),w=streamHalfWidth(u);
  left.push([p.x-t.z*w,p.z+t.x*w]);right.push([p.x+t.z*w,p.z-t.x*w]);
}
const outline=[...left];
for(const [u,sign]of[[1,1],[0,-1]]){
 const p=stream.getPointAt(u),t=stream.getTangentAt(u),w=streamHalfWidth(u);
 for(let i=1;i<12;i++){const a=i*Math.PI/12;outline.push([p.x-t.z*Math.cos(a)*w*sign+t.x*Math.sin(a)*w*sign,p.z+t.x*Math.cos(a)*w*sign+t.z*Math.sin(a)*w*sign]);}
 if(u)outline.push(...right.slice().reverse());
}
const island=Array.from({length:208},(_,i)=>{const a=i/208*Math.PI*2,r=shoreRadius(a);return[Math.cos(a)*r,Math.sin(a)*r];});
const output=JSON.stringify({...data,island,streamOutline:outline,
  streamLine:stream.getSpacedPoints(128).map(p=>[p.x,p.z]),
  paths:data.paths.map(p=>({...p,samples:curve(p.points).getSpacedPoints(100).map(q=>[q.x,q.z])}))});
if(process.argv[2])writeFileSync(process.argv[2],output);else console.log(output);
