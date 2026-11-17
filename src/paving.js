import * as THREE from '../vendor/three.module.js';

// Convex clipping partitions every road junction together. Shared Voronoi
// borders keep the stones irregular without overlapping or scattered tiles.
function clip(poly,nx,nz,limit){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*nz-limit,db=b[0]*nx+b[1]*nz-limit;
    if(da<=1e-8)out.push(a);
    if((da<0)!==(db<0)){
      const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
    }
  }
  const clean=out.filter((p,i)=>i===0||(p[0]-out[i-1][0])**2+(p[1]-out[i-1][1])**2>1e-14);
  if(clean.length>1&&(clean[0][0]-clean.at(-1)[0])**2+(clean[0][1]-clean.at(-1)[1])**2<1e-14)clean.pop();
  return clean;
}
export function insideStone(poly,x,z){
  let positive=false,negative=false;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],v=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);
    positive ||= v>1e-8;negative ||= v< -1e-8;
    if(positive&&negative)return false;
  }
  return true;
}
export function buildStonePaving({root,seeds,groundHeight,meditation,bridge,stoneBridge}){
  const exclusions=[
    {bridge, halfWidth:bridge.width/2+.025},
    {bridge:stoneBridge, halfWidth:stoneBridge.width/2+.025}
  ];
  const filtered=[];
  for(const seed of seeds){
    if(exclusions.some(({bridge:b,halfWidth})=>{
      const dx=seed.x-b.center.x,dz=seed.z-b.center.z,a=b.axis;
      return Math.abs(dx*a.x+dz*a.z)<b.length/2+.025&&Math.abs(-dx*a.z+dz*a.x)<halfWidth;
    }))continue;
    if(Math.hypot(seed.x-meditation.x,seed.z-meditation.z)<meditation.radius+.03)continue;
    if(filtered.some(p=>(p.x-seed.x)**2+(p.z-seed.z)**2<.12**2))continue;
    filtered.push(seed);
  }
  const positions=[],indices=[],colors=[],pavers=[];
  const palette=['#c2c5ae','#c9c9b1','#b7c0ab','#c7c7af','#bdc3ac'],color=new THREE.Color();
  function vertex(x,y,z,c){positions.push(x,y,z);colors.push(c.r,c.g,c.b);}
  for(let k=0;k<filtered.length;k++){
    const seed=filtered[k];let poly=seed.polygon;
    for(const other of filtered){
      const dx=other.x-seed.x,dz=other.z-seed.z;
      if((dx===0&&dz===0)||dx*dx+dz*dz>4)continue;
      poly=clip(poly,dx,dz,(other.x**2+other.z**2-seed.x**2-seed.z**2)/2);
      if(poly.length<3)break;
    }
    if(poly.length<3)continue;
    const pdx=seed.x-meditation.x,pdz=seed.z-meditation.z,dist=Math.hypot(pdx,pdz);
    if(dist<meditation.radius+.65){
      const nx=pdx/dist,nz=pdz/dist;
      poly=clip(poly,-nx,-nz,-(nx*meditation.x+nz*meditation.z+meditation.radius+.008));
    }
    for(const {bridge:b,halfWidth} of exclusions){
      const axis=b.axis,half=b.length/2+.025,dx=seed.x-b.center.x,dz=seed.z-b.center.z;
      const along=dx*axis.x+dz*axis.z,across=-dx*axis.z+dz*axis.x;
      if(Math.abs(along)<half+.9&&Math.abs(across)<halfWidth+.9){
        // Keep the half-plane on the seed's side of the footprint. This lets
        // paths turn around bridge corners without any stone entering them.
        const useAlong=Math.abs(along)-half>=Math.abs(across)-halfWidth;
        const n=-Math.sign(useAlong?along:across);
        const nx=useAlong?n*axis.x:-n*axis.z,nz=useAlong?n*axis.z:n*axis.x;
        const limit=nx*b.center.x+nz*b.center.z-(useAlong?half:halfWidth);
        poly=clip(poly,nx,nz,limit);
      }
      if(poly.length<3)break;
    }
    if(poly.length<3)continue;
    const area=Math.abs(poly.reduce((a,p,i)=>{const q=poly[(i+1)%poly.length];return a+p[0]*q[1]-p[1]*q[0];},0))/2;
    if(area<.012)continue;
    const cx=poly.reduce((a,p)=>a+p[0],0)/poly.length,cz=poly.reduce((a,p)=>a+p[1],0)/poly.length;
    // Narrow soil-filled joints are real space between beveled solid stones.
    poly=poly.map(([x,z])=>[cx+(x-cx)*.955,cz+(z-cz)*.955]);
    const inner=poly.map(([x,z])=>[cx+(x-cx)*.925,cz+(z-cz)*.925]);
    const heights=poly.map(([x,z])=>groundHeight(x,z));
    const top=Math.max(...heights)+.059+.005*Math.sin(k*2.39),bottom=Math.min(...heights)-.055;
    const base=positions.length/3,n=poly.length;
    color.set(palette[k%palette.length]);const darker=color.clone().multiplyScalar(.89);
    for(const ring of[0,1,2])for(let i=0;i<n;i++){
      const p=ring===2?inner[i]:poly[i];vertex(p[0],ring===0?bottom:ring===1?top-.019:top,p[1],ring===0?darker:color);
    }
    for(let ring=0;ring<2;ring++)for(let i=0;i<n;i++){
      const j=(i+1)%n,a=base+ring*n+i,b=base+ring*n+j;
      indices.push(a,a+n,b,b,a+n,b+n);
    }
    for(let i=1;i<n-1;i++)indices.push(base+2*n,base+2*n+i+1,base+2*n+i);
    pavers.push({polygon:inner,x:cx,z:cz,top,bottom});
  }
  let geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
  geometry=geometry.toNonIndexed();geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.96,side:THREE.DoubleSide}));
  mesh.name='Connected beveled stone paving';mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  return{mesh,pavers};
}
