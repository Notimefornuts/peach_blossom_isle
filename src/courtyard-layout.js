// Shared measured plan: the drawing and the Three.js garden use these same
// coordinates. X runs left/right; positive Z is the front of the island.
export const courtyardLayout = {
  // The order is also the direction of the current: bamboo -> Go table.
  stream: [[4.80,.73],[4.50,1.03],[4.05,1.20],[3.60,1.25],[3.30,1.32],[2.75,1.58],
    [2.25,2.00],[1.75,2.47],[1.05,2.95],[.35,3.30],[-.40,3.68],
    [-.95,3.88],[-1.35,3.58],[-1.80,3.25],[-2.20,3.25],
    [-2.75,3.45],[-3.40,3.48],[-3.80,3.30]],
  bridge: { x:-1.35, z:3.58, length:2.08, yaw:.90, base:.85 },
  stoneBridge: { x:2.25, z:2.00, length:1.18, width:.56, yaw:-.85 },
  meditation: { x:3.62, z:2.40, radius:.72 },
  lantern: { x:4.68, z:1.78 },
  forecourt: { minX:-.10, maxX:2.10, minZ:.94, maxZ:1.65 },
  healing: { x:.65, y:1, z:4.20 },
  lakeStep: [1.595125638914644,4.644893980249861],
  paths: [
    { id:'entry-chess', name:'入口至棋席', width:.72,
      points:[[.96,1.52],[.10,1.66],[-.65,1.75],[-1.30,1.90]] },
    { id:'chess-bridge', name:'棋席至石拱桥', width:.62,
      points:[[-1.30,1.90],[-1.08,2.05],[-.83,2.37],'bridge-house'] },
    { id:'waterside', name:'过桥沿水至静修', width:.64,
      points:['bridge-front',[-2.17,4.61],[-2.28,4.76],[-2.13,4.93],[-1.85,5.04],
        [-1.50,5.02],[-1.15,4.83],[-.50,4.54],
        [.65,4.25],[1.60,3.96],[2.65,3.75],[3.14,3.36],'pad-front'] },
    { id:'entry-stone', name:'入口至石板桥', width:.52,
      points:[[.96,1.52],[1.40,1.43],'stone-house-approach'] },
    { id:'stone-pad', name:'石板桥至打坐台', width:.42,
      points:['stone-garden-approach',[2.82,2.52],[2.91,2.42]] },
    { id:'lake-steps', name:'临水石阶支路', width:.54,
      points:[[.65,4.25],[1.18,4.38],'lake-step'] }
  ]
};

export const streamHalfWidth = u => .25 + .20*Math.sin(u*Math.PI)**2 +
  .035*Math.sin(u*Math.PI*5+.6);

export function resolveCourtyardLayout() {
  const c=courtyardLayout, b=c.bridge, s=c.stoneBridge, m=c.meditation;
  const axis=[Math.cos(b.yaw),-Math.sin(b.yaw)];
  const front=[b.x-axis[0]*b.length/2,b.z-axis[1]*b.length/2];
  const house=[b.x+axis[0]*b.length/2,b.z+axis[1]*b.length/2];
  const stoneAxis=[Math.cos(s.yaw),-Math.sin(s.yaw)];
  const stoneHouse=[s.x-stoneAxis[0]*s.length/2,s.z-stoneAxis[1]*s.length/2];
  const stoneGarden=[s.x+stoneAxis[0]*s.length/2,s.z+stoneAxis[1]*s.length/2];
  const points={
    'bridge-house':house, 'bridge-front':front,
    'stone-house-approach':[stoneHouse[0]-stoneAxis[0]*.14,stoneHouse[1]-stoneAxis[1]*.14],
    'stone-garden-approach':[stoneGarden[0]+stoneAxis[0]*.14,stoneGarden[1]+stoneAxis[1]*.14],
    'pad-front':[m.x-.38*m.radius,m.z+.925*m.radius],
    'lake-step':c.lakeStep
  };
  return {...c, bridge:{...b,axis,front,house},
    stoneBridge:{...s,axis:stoneAxis,house:stoneHouse,garden:stoneGarden},
    paths:c.paths.map(p=>({...p,points:p.points.map(v=>typeof v==='string'?points[v]:v)}))};
}
