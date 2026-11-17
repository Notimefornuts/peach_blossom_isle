const clampByte = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;

// Orthographic scan conversion. Vertex layout: screen x/y, depth, lit RGB
// (0–255), texture u/v. Frame color is straight-alpha RGBA ImageData.
// Linear byte value to sRGB byte, used when the shading stays in linear
// space until the final encode.
const linearToSrgb = new Uint8ClampedArray(256);
for (let i = 0; i < 256; i++) {
  const l = i / 255;
  linearToSrgb[i] = Math.round(255 * (l <= .0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - .055));
}

export function rasterTriangle(frame, vertices, ia, ib, ic, material) {
  ia *= 8;
  ib *= 8;
  ic *= 8;

  // Sort by y. Walking the two edges produces contiguous spans and avoids
  // shading the large empty rectangles around narrow leaves and railings.
  if (vertices[ia + 1] > vertices[ib + 1]) {
    const t = ia;
    ia = ib;
    ib = t;
  }
  if (vertices[ib + 1] > vertices[ic + 1]) {
    const t = ib;
    ib = ic;
    ic = t;
  }
  if (vertices[ia + 1] > vertices[ib + 1]) {
    const t = ia;
    ia = ib;
    ib = t;
  }
  const ax = vertices[ia],
    ay = vertices[ia + 1];
  const bx = vertices[ib],
    by = vertices[ib + 1];
  const cx = vertices[ic],
    cy = vertices[ic + 1];
  const w = frame.width,
    h = frame.height;
  const firstY = Math.max(0, Math.ceil(ay - .5));
  const endY = Math.min(h, Math.ceil(cy - .5));
  if (firstY >= endY || Math.max(ax, bx, cx) < .5 || Math.min(ax, bx, cx) >= w - .5) return;
  const dx1 = bx - ax,
    dy1 = by - ay,
    dx2 = cx - ax,
    dy2 = cy - ay;
  const area = dx1 * dy2 - dx2 * dy1;
  if (!Number.isFinite(area) || Math.abs(area) < 1e-7) return;

  const inverse = 1 / area;
  const bdx = dy2 * inverse,
    cdx = -dy1 * inverse;
  const bdy = -dx2 * inverse,
    cdy = dx1 * inverse;
  const az = vertices[ia + 2],
    ar = vertices[ia + 3],
    ag = vertices[ia + 4],
    ab = vertices[ia + 5];
  const bz = vertices[ib + 2] - az,
    cz = vertices[ic + 2] - az;
  const br = vertices[ib + 3] - ar,
    cr = vertices[ic + 3] - ar;
  const bg = vertices[ib + 4] - ag,
    cg = vertices[ic + 4] - ag;
  const bb = vertices[ib + 5] - ab,
    cb = vertices[ic + 5] - ab;
  const zx = bdx * bz + cdx * cz,
    zy = bdy * bz + cdy * cz;
  const rx = bdx * br + cdx * cr,
    ry = bdy * br + cdy * cr;
  const gx = bdx * bg + cdx * cg,
    gy = bdy * bg + cdy * cg;
  const blueX = bdx * bb + cdx * cb,
    blueY = bdy * bb + cdy * cb;
  const color = frame.color,
    depth = frame.depth;
  const opacity = material.opacity ?? 1;
  const threshold = material.alphaTest || 0;
  if (opacity <= 0 || opacity < threshold) return;
  const writeDepth = material.depthWrite !== false;
  const texture = material.texture;
  let texels = texture?.data;
  let au = 0,
    av = 0,
    ux = 0,
    uy = 0,
    vx = 0,
    vy = 0;
  let tw = 0,
    th = 0,
    repeatS = false,
    repeatT = false;
  if (texels) {
    tw = texture.width;
    th = texture.height;
    const scaleU = texture.repeatX ?? 1,
      scaleV = texture.repeatY ?? 1;
    const flip = texture.flipY !== false;
    const aU = vertices[ia + 6],
      aV = vertices[ia + 7];
    // Interpolate directly in texel space to simplify the hot loop.
    au = (aU * scaleU + (texture.offsetX || 0)) * tw;
    const originV = aV * scaleV + (texture.offsetY || 0);
    av = (flip ? 1 - originV : originV) * th;
    const duB = (vertices[ib + 6] - aU) * scaleU * tw;
    const duC = (vertices[ic + 6] - aU) * scaleU * tw;
    const vScale = scaleV * th * (flip ? -1 : 1);
    const dvB = (vertices[ib + 7] - aV) * vScale;
    const dvC = (vertices[ic + 7] - aV) * vScale;
    ux = bdx * duB + cdx * duC;
    uy = bdy * duB + cdy * duC;
    vx = bdx * dvB + cdx * dvC;
    vy = bdy * dvB + cdy * dvC;
    if (texture.levels) {
      const footprint = Math.min(Math.hypot(ux, vx), Math.hypot(uy, vy));
      const level = Math.min(texture.levels.length, Math.max(0, Math.floor(Math.log2(Math.max(1, footprint)) -
        .2)));
      if (level) {
        const mip = texture.levels[level - 1],
          sx = mip.width / tw,
          sy = mip.height / th;
        tw = mip.width;
        th = mip.height;
        texels = mip.data;
        au *= sx;
        ux *= sx;
        uy *= sx;
        av *= sy;
        vx *= sy;
        vy *= sy;
      }
    }
    repeatS = texture.wrapS === 'repeat' || texture.wrapS === 1000;
    repeatT = texture.wrapT === 'repeat' || texture.wrapT === 1000;
  }
  const slopeAC = dx2 / dy2;
  const slopeAB = dy1 > 0 ? dx1 / dy1 : 0;
  const slopeBC = cy > by ? (cx - bx) / (cy - by) : 0;
  for (let y = firstY; y < endY; y++) {
    const centerY = y + .5,
      fy = centerY - ay;
    const edgeAC = ax + slopeAC * fy;
    const edgeOther = centerY < by ? ax + slopeAB * fy : bx + slopeBC * (centerY - by);
    const startX = Math.max(0, Math.ceil(Math.min(edgeAC, edgeOther) - .5));
    const endX = Math.min(w, Math.ceil(Math.max(edgeAC, edgeOther) - .5));
    if (startX >= endX) continue;
    const fx = startX + .5 - ax;
    let z = az + zx * fx + zy * fy;
    let r = ar + rx * fx + ry * fy;
    let g = ag + gx * fx + gy * fy;
    let b = ab + blueX * fx + blueY * fy;
    let pixel = y * w + startX;
    const end = pixel + endX - startX;
    if (!texels && opacity >= 1) {
      // Nearly all of the miniature's geometry is opaque and untextured.
      for (; pixel < end; pixel++, z += zx, r += rx, g += gx, b += blueX) {
        if (z > depth[pixel]) continue;
        const c = pixel * 4;
        color[c] = r;
        color[c + 1] = g;
        color[c + 2] = b;
        color[c + 3] = 255;
        if (writeDepth) depth[pixel] = z;
      }
      continue;
    }
    let u = au + ux * fx + uy * fy,
      v = av + vx * fx + vy * fy;
    for (; pixel < end; pixel++, z += zx, r += rx, g += gx, b += blueX, u += ux, v += vx) {
      if (z > depth[pixel]) continue;
      let R = r,
        G = g,
        B = b,
        alpha = opacity;
      if (texels) {
        let tx = Math.floor(u),
          ty = Math.floor(v);
        if (tx < 0 || tx >= tw) tx = repeatS ? tx - tw * Math.floor(tx / tw) : tx < 0 ? 0 : tw - 1;
        if (ty < 0 || ty >= th) ty = repeatT ? ty - th * Math.floor(ty / th) : ty < 0 ? 0 : th - 1;
        const t = (ty * tw + tx) * 4;
        alpha *= texels[t + 3] / 255;
        if (alpha <= 0 || alpha < threshold) continue;
        if (material.linearLight) {
          // The lit colour is still linear, so the linear map multiplies in
          // directly and only the result is encoded to sRGB.
          R *= texels[t] / 255;
          G *= texels[t + 1] / 255;
          B *= texels[t + 2] / 255;
          R = linearToSrgb[clampByte(R * 255)];
          G = linearToSrgb[clampByte(G * 255)];
          B = linearToSrgb[clampByte(B * 255)];
        } else {
          R *= texels[t] / 255;
          G *= texels[t + 1] / 255;
          B *= texels[t + 2] / 255;
        }
      }
      const c = pixel * 4;
      if (alpha >= .9999 || color[c + 3] === 0) {
        color[c] = R;
        color[c + 1] = G;
        color[c + 2] = B;
        color[c + 3] = alpha * 255;
      } else {
        const keep = (1 - alpha) * color[c + 3] / 255;
        const out = alpha + keep,
          invOut = 1 / out;
        color[c] = (R * alpha + color[c] * keep) * invOut;
        color[c + 1] = (G * alpha + color[c + 1] * keep) * invOut;
        color[c + 2] = (B * alpha + color[c + 2] * keep) * invOut;
        color[c + 3] = out * 255;
      }
      if (writeDepth) depth[pixel] = z;
    }
  }
}
