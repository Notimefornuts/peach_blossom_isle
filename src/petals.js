import * as THREE from '../vendor/three.module.js';
export function buildPetals(scene, tree, garden, house, low) {
  const count = low ? 50 : 112,
    geometry = new THREE.CircleGeometry(1, 7),
    material = new THREE.MeshLambertMaterial({
      color: '#f5d3d0',
      side: THREE.DoubleSide
    });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'Drifting peach petals';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const pose = new THREE.Object3D(),
    pool = [],
    color = new THREE.Color();
  let next = 0;

  function ground(p) {
    const r = house.roofHeight(p.x, p.z);
    if (r && p.y > r - .12) return r;
    if (Math.abs(p.x + 2.75) < .96 && Math.abs(p.z - 1.70) < .65 && p.y > 1.36) {
      return Math.abs(p.x + 2.84) < .49 && Math.abs(p.z - 1.72) < .49 ? 1.45 : 1.42;
    }
    const bridge = garden.bridgeSurfaceAt(p.x, p.z), stone = garden.stoneSurfaceAt(p.x, p.z);
    if (bridge !== null) return bridge;
    if (stone !== null) return stone;
    if (garden.streamAt(p.x, p.z)) return .746;
    return Math.hypot(p.x, p.z) < garden.shoreRadius(Math.atan2(p.z, p.x)) ? garden.groundHeight(p.x, p.z) +
      .016 : .018;
  }

  function spawn(p, floating = false) {
    const v = tree.blossomPoint();
    p.x = v.x;
    p.y = v.y;
    p.z = v.z;
    p.a = Math.random() * Math.PI * 2;
    p.size = .038 + Math.random() * .036;
    p.v = .35 + Math.random() * .33;
    p.wind = .25 + Math.random() * .36;
    p.age = 0;
    p.fade = 1;
    p.state = 0;
    if (floating) {
      const a = Math.random() * Math.PI * 2,
        r = garden.shoreRadius(a) + .3 + Math.random() * 6;
      p.x = Math.cos(a) * r;
      p.z = Math.sin(a) * r;
      p.y = .019;
      p.state = 1;
      if (Math.random() < .28) {
        p.state = 3;
        p.streamU = .06 + Math.random() * .86;
        p.streamOffset = (Math.random() - .5) * .22;
        garden.flowPetal(p, 0, 0);
      }
    }
  }
  for (let i = 0; i < count; i++) {
    const p = {};
    spawn(p, i < count * .55);
    pool.push(p);
    mesh.setColorAt(i, color.set(['#f8ded8', '#e6b9c5', '#efd3d9', '#e9afbf'][i % 4]));
  }
  return {
    burst() {
      for (let i = 0; i < (low ? 12 : 24); i++) {
        spawn(pool[next]);
        next = (next + 1) % count;
      }
    },
    act() {},
    setTime() {},
    update(t, dt) {
      for (let i = 0; i < count; i++) {
        const p = pool[i];
        p.age += dt;
        let rx = -Math.PI / 2;
        if (p.state === 0) {
          p.x += (p.wind + .12 * Math.sin(t + p.a)) * dt;
          p.z += (.10 + .16 * Math.cos(t * .7 + p.a)) * dt;
          const floor = ground(p);
          p.y -= p.v * dt;
          rx += Math.sin(t * 2 + p.a);
          if (p.y <= floor) {
            p.y = floor;
            p.state = floor < .1 ? 1 : 2;
            const stream = floor > .73 && floor < .77 ? garden.streamAt(p.x, p.z) : null;
            if (stream) {
              p.state = 3;
              p.streamU = stream.u;
              p.streamOffset = THREE.MathUtils.clamp((p.x - stream.point.x) * stream.normal.x +
                (p.z - stream.point.z) * stream.normal.z, -.18, .18);
            }
            p.age = 0;
          }
        } else if (p.state === 1) {
          p.x += (.17 + .025 * Math.sin(p.z + t * .3)) * dt;
          p.z += (.065 + .024 * Math.sin(t * .5 + p.a)) * dt;
          if (p.age > 35) spawn(p);
        } else if (p.state === 3) {
          p.fade = Math.min(1, (1 - p.streamU) / .035);
          if (!garden.flowPetal(p, dt, t) || p.age > 36) spawn(p);
        } else if (p.age > 8) spawn(p);
        pose.position.set(p.x, p.y, p.z);
        pose.rotation.set(rx, 0, p.a + t * (p.state === 1 || p.state === 3 ? .08 : .35));
        pose.scale.set(p.size * .75 * p.fade, p.size * p.fade, p.size * p.fade);
        pose.updateMatrix();
        mesh.setMatrixAt(i, pose.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}
