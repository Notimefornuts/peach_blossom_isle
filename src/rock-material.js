import * as THREE from '../vendor/three.module.js';

// The offline build supplies the same three maps as data URLs.
const sources = globalThis.ISLE_TEXTURES ?? {
  albedo: new URL('../assets/textures/rock-albedo.webp', import.meta.url).href,
  normal: new URL('../assets/textures/rock-normal.webp', import.meta.url).href,
  orm: new URL('../assets/textures/rock-orm.webp', import.meta.url).href
};

// The albedo map is a detail layer whose linear average sits near 0.56, so the
// per-instance tint is lifted by the same factor to keep the island's
// established value. Recompute with tools/build_rock_textures.py.
export const ROCK_TINT_GAIN = 1.787;

// Weathering constants. The stone stays a pale limestone and the growth is
// painted by the shader. The moss family is a low saturation grey green: a
// lighter colony tone on the crowns, a darker one in the crevices and a pale
// dried fringe at the border of each patch.
const MOSS_TINT = new THREE.Color('#7b9070');
const MOSS_DEEP = new THREE.Color('#5d6d5c');
const MOSS_FRINGE = new THREE.Color('#98a489');
const MOSS_GAIN = 1.0;
// World height of the wet line: below it the stone darkens and turns glossy
// where the lake laps against the rock foot.
const WET_TOP = .30;
const DETAIL = .88;
const NORMAL_SCALE = 1.35;
// One texture tile per 0.55 world unit, so the stone keeps a fine grain at the
// scale the boulders are seen from the shore.
const UV_SCALE = 1.8;
// The silhouette keeps a carved facet, but the surface is shaded smooth so
// the stone reads as weathered rock rather than a cut gem.
const SMOOTH_SHADE = .74;

export async function loadRockTextures(anisotropy = 4) {
  const loader = new THREE.TextureLoader();
  try {
    const [albedo, normal, orm] = await Promise.all([
      loader.loadAsync(sources.albedo),
      loader.loadAsync(sources.normal),
      loader.loadAsync(sources.orm)
    ]);
    albedo.colorSpace = THREE.SRGBColorSpace;
    for (const texture of [albedo, normal, orm]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = anisotropy;
    }
    // The CPU fallback multiplies texture bytes straight into the lit colour,
    // so it needs the map in linear space to match the GPU path.
    albedo.userData.linearize = true;
    return { albedo, normal, orm };
  } catch (error) {
    // The island stays usable if a map could not be loaded.
    console.warn('Rock maps unavailable; using the original stones.', error);
    return null;
  }
}

// World space triplanar sampling keeps the texel density even across rocks of
// very different size and removes the stretching a baked UV would cause.
const COMMON = /* glsl */`
  uniform vec3 uRockMoss;
  uniform float uRockMossGain;
  uniform float uRockDetail;
  uniform float uRockNormalScale;
  uniform float uRockScale;
  uniform float uRockSmooth;
  varying vec3 vRockPos;
  varying vec3 vRockWNormal;
  varying float vRockCavity;
  varying vec4 vRockData;
  uniform vec3 uRockMossDeep;
  uniform vec3 uRockMossFringe;
  uniform float uWetTop;

  float rockHash( vec3 p ) {
    p = fract( p * 0.3183099 + vec3( 0.71, 0.113, 0.419 ) );
    p *= 17.0;
    return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
  }
  float rockNoise( vec3 p ) {
    vec3 i = floor( p );
    vec3 f = fract( p );
    f = f * f * ( 3.0 - 2.0 * f );
    float n000 = rockHash( i );
    float n100 = rockHash( i + vec3( 1.0, 0.0, 0.0 ) );
    float n010 = rockHash( i + vec3( 0.0, 1.0, 0.0 ) );
    float n110 = rockHash( i + vec3( 1.0, 1.0, 0.0 ) );
    float n001 = rockHash( i + vec3( 0.0, 0.0, 1.0 ) );
    float n101 = rockHash( i + vec3( 1.0, 0.0, 1.0 ) );
    float n011 = rockHash( i + vec3( 0.0, 1.0, 1.0 ) );
    float n111 = rockHash( i + vec3( 1.0, 1.0, 1.0 ) );
    return mix(
      mix( mix( n000, n100, f.x ), mix( n010, n110, f.x ), f.y ),
      mix( mix( n001, n101, f.x ), mix( n011, n111, f.x ), f.y ), f.z );
  }
  vec3 rockWeights( vec3 n ) {
    vec3 w = pow( abs( n ), vec3( 5.0 ) );
    return w / max( w.x + w.y + w.z, 1e-4 );
  }
  // Shared by the colour and roughness passes: how wet this fragment is.
  float rockWetAmount;
`;

export function createRockMaterial(textures, low) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide
  });
  if (!textures) return material;
  material.map = textures.albedo;
  material.normalMap = textures.normal;
  material.roughnessMap = textures.orm;
  material.normalScale = new THREE.Vector2(NORMAL_SCALE, NORMAL_SCALE);
  material.defines = Object.assign({}, material.defines, low ? {} : { ROCK_TRIPLANAR: '' });
  material.userData.rock = true;
  material.userData.tintGain = ROCK_TINT_GAIN;
  material.onBeforeCompile = shader => {
    shader.uniforms.uRockMoss = { value: MOSS_TINT };
    shader.uniforms.uRockMossDeep = { value: MOSS_DEEP };
    shader.uniforms.uRockMossFringe = { value: MOSS_FRINGE };
    shader.uniforms.uWetTop = { value: WET_TOP };
    shader.uniforms.uRockMossGain = { value: MOSS_GAIN };
    shader.uniforms.uRockDetail = { value: DETAIL };
    shader.uniforms.uRockNormalScale = { value: NORMAL_SCALE };
    shader.uniforms.uRockScale = { value: UV_SCALE };
    shader.uniforms.uRockSmooth = { value: SMOOTH_SHADE };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        attribute vec4 aRockData;
        attribute vec3 aFacetNormal;
        attribute float aCavity;
        uniform float uRockSmooth;
        varying vec3 vRockPos;
        varying vec3 vRockWNormal;
        varying float vRockCavity;
        varying vec4 vRockData;
      `)
      // The stone is shaded mostly with the averaged normal so the surface
      // reads as weathered rock; a little of the carved facet is kept so the
      // low polygon silhouette still shows in the light.
      .replace('#include <beginnormal_vertex>', /* glsl */`
        vec3 rockFacet = normalize( aFacetNormal );
        vec3 rockAverage = normal;
        vec3 objectNormal = normalize( mix( rockFacet, rockAverage, uRockSmooth ) );
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif
      `)
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vRockPos = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
        #else
          vRockPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
        #endif
        vRockData = aRockData;
        // The averaged normal is kept in world space: the triplanar blend and
        // the moss up test must not follow the camera.
        vec3 rockSmooth = rockAverage;
        vRockCavity = aCavity;
        #ifdef USE_INSTANCING
          mat3 rockIm = mat3( instanceMatrix );
          rockSmooth /= vec3( dot( rockIm[ 0 ], rockIm[ 0 ] ), dot( rockIm[ 1 ], rockIm[ 1 ] ), dot( rockIm[ 2 ], rockIm[ 2 ] ) );
          rockSmooth = normalize( rockIm * rockSmooth );
        #endif
        vRockWNormal = normalize( mat3( modelMatrix ) * rockSmooth );
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        ${COMMON}
      `)
      // Albedo and the packed occlusion/roughness/lichen map are sampled with
      // one triplanar projection so no facet is ever stretched.
      .replace('#include <map_fragment>', /* glsl */`
        vec3 rockN = normalize( vRockWNormal );
        vec3 rockW = rockWeights( rockN );
        vec3 rockP = vRockPos * ( uRockScale * vRockData.z );
        vec2 rockOff = vRockData.xy;
        // Each projection keeps a right handed frame: u along the tangent,
        // v along the bitangent, so the tangent space normal maps read true.
        vec2 rockUvX = rockP.yz + rockOff;
        vec2 rockUvY = rockP.zx + rockOff;
        vec2 rockUvZ = rockP.xy + rockOff;
        vec4 rockAlbedo;
        vec4 rockOrm;
        #ifdef ROCK_TRIPLANAR
          rockAlbedo = texture2D( map, rockUvX ) * rockW.x
                     + texture2D( map, rockUvY ) * rockW.y
                     + texture2D( map, rockUvZ ) * rockW.z;
          rockOrm = texture2D( roughnessMap, rockUvX ) * rockW.x
                  + texture2D( roughnessMap, rockUvY ) * rockW.y
                  + texture2D( roughnessMap, rockUvZ ) * rockW.z;
        #else
          if ( rockW.x >= rockW.y && rockW.x >= rockW.z ) {
            rockAlbedo = texture2D( map, rockUvX );
            rockOrm = texture2D( roughnessMap, rockUvX );
          } else if ( rockW.y >= rockW.z ) {
            rockAlbedo = texture2D( map, rockUvY );
            rockOrm = texture2D( roughnessMap, rockUvY );
          } else {
            rockAlbedo = texture2D( map, rockUvZ );
            rockOrm = texture2D( roughnessMap, rockUvZ );
          }
        #endif
        // A slow, mean preserving blotch breaks the shared tiling of every stone.
        float rockBlotch = rockNoise( vRockPos * 1.45 );
        rockAlbedo.rgb *= mix( 1.0, 0.68 + 0.66 * rockBlotch, uRockDetail );
        diffuseColor *= rockAlbedo;
      `)
      // Moss follows the instance colour, so it lands after the tint is applied.
      .replace('#include <color_fragment>', /* glsl */`
        #include <color_fragment>
        {
          // Growth collects on the upward faces and thins out towards the
          // shaded flanks, exactly where the reference boulders carry it.
          float rockUp = smoothstep( 0.20, 0.84, rockN.y );
          // Three patch fields of different scale keep the growth from
          // reading as one solid cap: broad colonies broken by finer clumps.
          float rockPatch = rockNoise( vRockPos * 3.6 + 11.0 );
          float rockClump = rockNoise( vRockPos * 8.4 + 57.0 );
          float rockMask = smoothstep( 0.32, 0.74,
            rockBlotch * 0.34 + rockPatch * 0.38 + rockClump * 0.28 );
          float rockMoss = clamp( rockUp * rockMask * vRockData.w * uRockMossGain, 0.0, 1.0 );
          // The seams between the leaning masses and thin weathered crack
          // lines carry growth regardless of slope, so the moss runs from the
          // crown down into every crevice and joint of the pile.
          float rockCrack = 1.0 - smoothstep( 0.02, 0.11,
            abs( rockNoise( vRockPos * 4.8 + 7.0 ) - 0.5 ) );
          rockCrack *= rockCrack;
          float rockCrevice = clamp( vRockCavity * 0.90 + rockCrack * 0.50, 0.0, 1.0 );
          float rockCreviceMask = smoothstep( 0.28, 0.68, rockPatch * 0.5 + rockClump * 0.5 );
          rockMoss = clamp( rockMoss +
            rockCrevice * rockCreviceMask * vRockData.w * uRockMossGain * 0.85, 0.0, 1.0 );
          // Damp streaks seep down from the crown over the flanks.
          float rockSeep = rockNoise( vec3( vRockPos.x * 5.2, vRockPos.y * 1.7, vRockPos.z * 5.2 ) + 23.0 );
          rockSeep = smoothstep( 0.54, 0.82, rockSeep ) * ( 1.0 - rockUp ) *
            smoothstep( 0.05, 0.40, rockN.y + 0.30 );
          rockMoss = clamp( rockMoss + rockSeep * rockMask * vRockData.w * 0.60, 0.0, 1.0 );
          // A fine grain eats into the edge of the growth, so the moss ends in
          // scattered specks instead of a clean decal edge.
          float rockGrain = rockNoise( vRockPos * 13.0 );
          rockMoss = smoothstep( 0.24, 0.66, rockMoss + ( rockGrain - 0.5 ) * 0.52 );
          // Low saturation grey green: darker in the crevices, a little lighter
          // where the colonies stand up into the light.
          vec3 rockMossColor = mix( uRockMossDeep, uRockMoss, smoothstep( 0.15, 0.70, rockUp ) );
          rockMossColor *= mix( 0.62, 1.0, rockOrm.r * ( 1.0 - vRockCavity * .5 ) );
          float rockMossTone = rockNoise( vRockPos * 4.4 + 31.0 );
          rockMossColor *= mix( 0.78, 1.16, rockMossTone );
          rockMossColor *= mix( 0.92, 1.10, rockGrain );
          // The thin fringe of the growth is paler and greyer than the thick
          // patch, which is how moss dries at its border.
          rockMossColor = mix( uRockMossFringe, rockMossColor, smoothstep( 0.30, 0.72, rockMoss ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, rockMossColor, rockMoss );
          // Wet foot: the stone darkens and turns glossy where the lake laps,
          // with a noisy edge so the tide line follows the rock, not a plane.
          rockWetAmount = 1.0 - smoothstep( uWetTop - 0.22, uWetTop + 0.04,
            vRockPos.y + ( rockNoise( vRockPos * 6.5 ) - 0.5 ) * 0.14 );
          diffuseColor.rgb *= mix( 1.0, 0.46, rockWetAmount );
          diffuseColor.rgb = mix( diffuseColor.rgb,
            diffuseColor.rgb * vec3( 0.80, 0.90, 0.93 ), rockWetAmount * 0.7 );
        }
      `)
      .replace('#include <roughnessmap_fragment>', /* glsl */`
        float roughnessFactor = roughness;
        roughnessFactor *= rockOrm.g;
        roughnessFactor = clamp( roughnessFactor, 0.08, 1.0 );
        // The wet foot of the stone reads glossy against the dry crown.
        roughnessFactor = mix( roughnessFactor, 0.17, rockWetAmount * 0.85 );
      `)
      .replace('#include <normal_fragment_maps>', /* glsl */`
        {
          // The tangent space map is read as a height gradient, which lets the
          // detail be laid over the carved facets without erasing them.
          vec3 rockBump;
          #ifdef ROCK_TRIPLANAR
            vec3 nX = texture2D( normalMap, rockUvX ).xyz * 2.0 - 1.0;
            vec3 nY = texture2D( normalMap, rockUvY ).xyz * 2.0 - 1.0;
            vec3 nZ = texture2D( normalMap, rockUvZ ).xyz * 2.0 - 1.0;
            rockBump = ( vec3( 0.0, 1.0, 0.0 ) * nX.x + vec3( 0.0, 0.0, 1.0 ) * nX.y ) * rockW.x
                     + ( vec3( 0.0, 0.0, 1.0 ) * nY.x + vec3( 1.0, 0.0, 0.0 ) * nY.y ) * rockW.y
                     + ( vec3( 1.0, 0.0, 0.0 ) * nZ.x + vec3( 0.0, 1.0, 0.0 ) * nZ.y ) * rockW.z;
          #else
            vec3 nX = texture2D( normalMap, rockUvX ).xyz * 2.0 - 1.0;
            rockBump = vec3( 0.0, 1.0, 0.0 ) * nX.x + vec3( 0.0, 0.0, 1.0 ) * nX.y;
          #endif
          rockBump *= uRockNormalScale;
          normal = normalize( normal + ( viewMatrix * vec4( rockBump, 0.0 ) ).xyz );
        }
      `)
      .replace('#include <aomap_fragment>', /* glsl */`
        {
          // The red channel carries the baked cavity occlusion of the stone,
          // and the crevice term darkens the seams of the boulder cluster.
          reflectedLight.indirectDiffuse *= mix( 0.76, 1.0, rockOrm.r ) * mix( 1.0, 0.58, vRockCavity );
        }
      `);
  };
  return material;
}
