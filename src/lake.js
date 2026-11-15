import * as THREE from '../vendor/three.module.js';
import {
  shoreRadius
} from './landscape.js';
export const palettes = [{
  sky: '#eceee3',
  mist: '#d8e5df',
  water: '#a6d0cc',
  deep: '#78b3ba',
  light: '#edf2db',
  mount: '#95b0aa'
}, {
  sky: '#e6d3c6',
  mist: '#d2c2c4',
  water: '#aebec5',
  deep: '#8b9eb5',
  light: '#f4d9bd',
  mount: '#a49fae'
}, {
  sky: '#263e56',
  mist: '#355b70',
  water: '#3d687d',
  deep: '#23465e',
  light: '#bed3d9',
  mount: '#4b677c'
}];
export function paintSky(mode) {
  const p = palettes[mode],
    c = document.querySelector('#wash canvas') || document.querySelector('#wash').appendChild(document
      .createElement('canvas'));
  c.width = 1440;
  c.height = 960;
  const g = c.getContext('2d'),
    grad = g.createLinearGradient(0, 0, 0, 960);
  [
    [0, p.sky],
    [.25, p.mist],
    [.50, p.water],
    [1, p.deep]
  ].forEach(([s, c]) => grad.addColorStop(s, c));
  g.fillStyle = grad;
  g.fillRect(0, 0, 1440, 960);
  for (let k = 0; k < 3; k++) {
    g.save();
    g.beginPath();
    g.moveTo(0, 310);
    for (let x = 0; x <= 1440; x += 3) {
      const a = x / 1440;
      g.lineTo(x, 115 + k * 27 + 25 * Math.sin(a * 12 + k) + 15 * Math.sin(a * 28 + k * 2) + 5 * Math.sin(a *
        67 + 2 * k));
    }
    g.lineTo(1440, 310);
    g.closePath();
    g.clip();
    const w = g.createLinearGradient(0, 80 + k * 27, 0, 244 + k * 25);
    w.addColorStop(0, p.mount);
    w.addColorStop(1, p.mist + '00');
    g.globalAlpha = .30;
    g.fillStyle = w;
    g.fillRect(0, 0, 1440, 400);
    g.restore();
  }
  for (let k = 0; k < 3; k++) {
    g.fillStyle = p.sky + '0c';
    g.beginPath();
    g.moveTo(0, 150 + k * 30);
    g.bezierCurveTo(350, 130 + k * 30, 900, 205 + k * 12, 1440, 170 + k * 25);
    g.lineTo(1440, 215 + k * 24);
    g.lineTo(0, 215 + k * 25);
    g.fill();
  }
}
export function buildLake({
  renderer,
  scene,
  camera,
  canvas,
  software
}) {
  const low = innerWidth < 700,
    pulses = Array.from({
      length: 8
    }, () => new THREE.Vector4(0, 0, -10, 0));
  let next = 0,
    mode = 0,
    force = true,
    lastMirror = -10;
  const mirrorCam = camera.clone(),
    matrix = new THREE.Matrix4(),
    prev = new THREE.Matrix4(),
    previousProjection = new THREE.Matrix4(),
    direction = new THREE.Vector3(),
    look = new THREE.Vector3();
  let plane, target, material, context;
  if (!software) {
    target = new THREE.WebGLRenderTarget(low ? 384 : 768, low ? 288 : 512);
    material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        time: {
          value: 0
        },
        tint: {
          value: new THREE.Color()
        },
        deep: {
          value: new THREE.Color()
        },
        shine: {
          value: new THREE.Color()
        },
        reflectionMap: {
          value: target.texture
        },
        mirrorVP: {
          value: matrix
        },
        pulses: {
          value: pulses
        }
      },
      vertexShader: 'varying vec3 wp; varying vec4 reflected; varying vec4 clip; uniform mat4 mirrorVP; void main(){vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;reflected=mirrorVP*w;clip=projectionMatrix*viewMatrix*w;gl_Position=clip;}',
      fragmentShader: `uniform float time;uniform vec3 tint,deep,shine;uniform sampler2D reflectionMap;uniform vec4 pulses[8];varying vec3 wp;varying vec4 reflected,clip;
 float hash(vec2 p){return fract(sin(dot(p,vec2(17.33,48.71)))*43758.5);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
 void main(){vec2 p=wp.xz;vec2 uv=clip.xy/clip.w*.5+.5;float grain=noise(p*.39);float wave=sin(p.y*4.4+p.x*.57+grain*7.+time*.49);float detail=sin(p.y*10.5-p.x*.95+noise(p*.8)*8.+time*.7);vec3 c=mix(tint,deep,(1.-uv.y)*.44+noise(p*.12)*.15);float highlight=smoothstep(.84,.99,wave)*pow(max(0.,grain-.3),1.5);c=mix(c,shine,highlight*.33+smoothstep(.97,1.,detail)*.04);vec2 mirroredUV=reflected.xy/reflected.w*.5+.5+vec2(wave*.0016,detail*.0015);vec4 ref=texture2D(reflectionMap,clamp(mirroredUV,0.,1.));c=mix(c,ref.rgb,ref.a*.29);float angle=atan(p.y,p.x);float outline=(1.+.065*sin(angle*3.+.8)+.042*cos(angle*5.+.5)+.026*sin(angle*8.-1.3)+.012*cos(angle*13.))/length(vec2(cos(angle)/6.1,sin(angle)/4.5));outline+=.68*pow(abs(cos(angle)),3.)+1.45*pow(max(0.,sin(angle)),2.);float bank=length(p)/outline;float shore=exp(-abs(bank-1.06)*21.)*pow(max(0.,cos((bank-1.)*72.-time*.6+grain*2.)),5.);c=mix(c,shine,shore*.19);for(int i=0;i<8;i++){float age=time-pulses[i].z;float r=distance(p,pulses[i].xy);float ring=sin((r-age)*22.)*exp(-pow((r-age+.16)*4.,2.))*step(0.,age)*(1.-smoothstep(.3,3.1,age));c=mix(c,shine,max(0.,ring)*.55*pulses[i].w);}gl_FragColor=vec4(c,smoothstep(.04,.65,1.-uv.y));
 #include <colorspace_fragment>
 }`
    });
    plane = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), material);
    plane.rotation.x = -Math.PI / 2;
    plane.renderOrder = -20;
    scene.add(plane);
  } else context = canvas.getContext('2d');
  let width = 1,
    height = 1;
  const point = new THREE.Vector3(),
    events = [],
    flecks = Array.from({
      length: 1000
    }, (_, i) => ({
      x: Math.sin(i * 232.7) * 42,
      z: Math.sin(i * 93.37) * 38,
      l: .3 + (i % 7) * .09,
      phase: i * 2.4
    }));

  function resize(w, h) {
    width = canvas.width = Math.round(w * Math.min(1, 1100 / w));
    height = canvas.height = Math.round(h * Math.min(1, 1100 / w));
    force = true;
  }

  function project(x, y, z) {
    point.set(x, y, z).project(camera);
    return [(point.x * .5 + .5) * width, (.5 - point.y * .5) * height];
  }

  function paintWater(t) {
    const g = context,
      p = palettes[mode];
    g.clearRect(0, 0, width, height);
    const grad = g.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, p.water + '00');
    grad.addColorStop(.24, p.water + '00');
    grad.addColorStop(.55, p.water + '55');
    grad.addColorStop(1, p.deep);
    g.fillStyle = grad;
    g.fillRect(0, 0, width, height);
    g.strokeStyle = p.light;
    g.lineWidth = .7;
    g.globalAlpha = .32;
    g.beginPath();
    for (const f of flecks) {
      const q = project(f.x + .12 * Math.sin(t * .5 + f.phase), 0, f.z);
      if (q[1] < height * .25 || q[1] > height || q[0] < 0 || q[0] > width) continue;
      const s = f.l * (.4 + q[1] / height) * 2;
      g.moveTo(q[0] - s * 2.5, q[1]);
      g.quadraticCurveTo(q[0], q[1] - .5, q[0] + s, q[1]);
    }
    g.stroke();
    for (let k = 0; k < 4; k++) {
      g.globalAlpha = .43 - k * .075;
      g.beginPath();
      let pen = false;
      for (let i = 0; i <= 180; i++) {
        const a = i / 180 * Math.PI * 2,
          r = shoreRadius(a) + .05 + k * .14 +
          .04 * Math.sin(a * 25 + t * .4);
        const q = project(Math.cos(a) * r, 0, Math.sin(a) * r);
        if (Math.sin(a * 39 + k) < -.53) {
          pen = false;
          continue;
        }
        if (!pen) {
          g.moveTo(...q);
          pen = true;
        } else g.lineTo(...q);
      }
      g.stroke();
    }
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i],
        age = t - e.t;
      if (age > 3.2) {
        events.splice(i, 1);
        continue;
      }
      g.globalAlpha = (1 - age / 3.2) * .8;
      for (let k = 0; k < 3; k++) {
        const r = age - k * .15;
        if (r <= 0) continue;
        g.beginPath();
        for (let j = 0; j <= 72; j++) {
          const a = j / 72 * Math.PI * 2,
            q = project(e.x + r * Math.cos(a), .01, e.z + r * Math.sin(a));
          if (j === 0) g.moveTo(...q);
          else g.lineTo(...q);
        }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  function setTime(i) {
    mode = i;
    paintSky(i);
    if (material) {
      const p = palettes[i];
      material.uniforms.tint.value.set(p.water);
      material.uniforms.deep.value.set(p.deep);
      material.uniforms.shine.value.set(p.light);
    }
    force = true;
  }
  return {
    plane,
    resize,
    setTime,
    ripple(x, z, t) {
      pulses[next].set(x, z, t, 1);
      next = (next + 1) % 8;
      events.push({
        x,
        z,
        t
      });
    },
    invalidate() {
      force = true;
    },
    update(t) {
      if (software) {
        paintWater(t);
        return;
      }
      material.uniforms.time.value = t;
      camera.updateMatrixWorld();
      const moved = !prev.equals(camera.matrixWorld) || !previousProjection.equals(camera.projectionMatrix);
      if (!force && t - lastMirror < (moved ? .18 : 1.2)) return;
      prev.copy(camera.matrixWorld);
      previousProjection.copy(camera.projectionMatrix);
      mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
      mirrorCam.position.copy(camera.position);
      mirrorCam.position.y *= -1;
      camera.getWorldDirection(direction);
      direction.y *= -1;
      mirrorCam.up.set(0, -1, 0);
      mirrorCam.lookAt(look.copy(mirrorCam.position).add(direction));
      mirrorCam.updateMatrixWorld();
      matrix.multiplyMatrices(mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse);
      const old = renderer.getRenderTarget(),
        pending = renderer.shadowMap.needsUpdate;
      renderer.shadowMap.needsUpdate = false;
      plane.visible = false;
      try {
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, mirrorCam);
      } finally {
        renderer.setRenderTarget(old);
        plane.visible = true;
        renderer.shadowMap.needsUpdate = pending;
      }
      force = false;
      lastMirror = t;
    }
  };
}
