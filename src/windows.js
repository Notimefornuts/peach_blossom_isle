import * as THREE from '../vendor/three.module.js';

// Window joinery follows the supplied Suzhou references. The large central
// lights stay open; the stepped fretwork is confined to the perimeter.
export function buildWindowLattice({
  width, height, panels = 1, style = 'bubu', detailed = false, low,
  rectangle, contour, materials
}) {
  const { timber } = materials;
  const bars = [];
  const stroke = (a, b, thickness = .019) => {
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
    const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    const r = thickness / 2;
    if (x1 - x0 < 1e-8) bars.push([x0 - r, y0 - r, x1 + r, y1 + r]);
    else if (y1 - y0 < 1e-8) bars.push([x0 - r, y0 - r, x1 + r, y1 + r]);
    else throw new Error('Window fretwork must be orthogonal');
  };
  const path = (points, thickness = .019, closed = false) => {
    for (let i = 1; i < points.length; i++) stroke(points[i - 1], points[i], thickness);
    if (closed) stroke(points.at(-1), points[0], thickness);
  };
  const border = (cx, w, h, line = .025) => path([
    [cx - w / 2, -h / 2], [cx + w / 2, -h / 2],
    [cx + w / 2, h / 2], [cx - w / 2, h / 2]
  ], line, true);

  if (style === 'haitang') {
    border(0, width, height, .027);
    const radiusX = width * .405, radiusY = height * .397;
    const count = low ? 48 : 72, line = .026;
    const flower = new THREE.CurvePath();
    // Three gentle Bézier arcs form each rounded lobe and its concave neck.
    const quarter = [
      [[0, 1], [-.31, 1], [-.55, .81], [-.50, .58]],
      [[-.50, .58], [-.49, .52], [-.52, .49], [-.58, .50]],
      [[-.58, .50], [-.81, .55], [-1, .31], [-1, 0]]
    ];
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const rotate = ([x, y]) => new THREE.Vector2(
        (x * Math.cos(angle) - y * Math.sin(angle)) * radiusX,
        (x * Math.sin(angle) + y * Math.cos(angle)) * radiusY
      );
      for (const segment of quarter) flower.add(new THREE.CubicBezierCurve(...segment.map(rotate)));
    }
    const point = angle => {
      const t = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
      return flower.getPoint(t);
    };
    const outer = [], inner = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * i / count, p = point(angle);
      const tangent = point(angle + .0001).sub(point(angle - .0001)).normalize();
      const normal = new THREE.Vector2(tangent.y, -tangent.x);
      outer.push(p.clone().addScaledVector(normal, line / 2));
      inner.push(p.clone().addScaledVector(normal, -line / 2));
    }
    const shape = new THREE.Shape(outer);
    shape.holes.push(new THREE.Path(inner.reverse()));
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: .043, steps: 1, bevelEnabled: true,
      bevelThickness: .002, bevelSize: .002, bevelSegments: 1, curveSegments: 1
    });
    geometry.translate(0, 0, -.043 / 2);
    contour(geometry, timber, .047);
    // Four stepped connections meet the outer face of the flower outline.
    // Their shoulders are recessed behind the ring, so joints stay clean.
    const neck = point(Math.PI / 4);
    const diagonal = new THREE.Vector2(Math.abs(neck.x), Math.abs(neck.y));
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const u = sx * diagonal.x, v = sy * diagonal.y;
        path([
          [sx * width / 2, sy * height * .28],
          [sx * width * .35, sy * height * .28],
          [sx * width * .35, sy * height * .40],
          [u, sy * height * .40],
          [u, v]
        ], .020);
        stroke([sx * width * .35, sy * height * .40],
          [sx * width * .35, sy * height / 2], .020);
      }
  } else {
    const mullion = .024, paneWidth = (width - mullion * (panels - 1)) / panels;
    for (let i = 0; i < panels; i++) {
      const cx = -width / 2 + paneWidth / 2 + i * (paneWidth + mullion);
      border(cx, paneWidth, height, .025);
      const a = paneWidth * .373, b = height * .345;
      const step = Math.min(paneWidth, height) * .083;
      path([
        [cx - a + step, b], [cx + a - step, b],
        [cx + a - step, b - step], [cx + a, b - step],
        [cx + a, -b + step], [cx + a - step, -b + step],
        [cx + a - step, -b], [cx - a + step, -b],
        [cx - a + step, -b + step], [cx - a, -b + step],
        [cx - a, b - step], [cx - a + step, b - step]
      ], .019, true);
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          stroke([cx + sx * (a - step), sy * b],
            [cx + sx * (a - step), sy * height / 2]);
          stroke([cx + sx * a, sy * (b - step)],
            [cx + sx * paneWidth / 2, sy * (b - step)]);
          if (detailed) path([
            [cx + sx * paneWidth / 2, sy * (b + step * .25)],
            [cx + sx * (a + step * .50), sy * (b + step * .25)],
            [cx + sx * (a + step * .50), sy * height / 2]
          ], .018);
        }
      // Short perimeter keys anchor the long borders without bisecting the view.
      if (!detailed) for (const sy of [-1, 1])
        stroke([cx, sy * b], [cx, sy * height / 2], .018);
    }
    for (let i = 1; i < panels; i++) {
      const x = -width / 2 + i * paneWidth + (i - .5) * mullion;
      stroke([x, -height / 2], [x, height / 2], mullion + .006);
    }
  }

  // Union the orthogonal bars before extrusion. Shared corners have a single
  // front surface instead of overlapping strips or doubled mitre lines.
  const quantize = n => Math.round(n * 1e6) / 1e6;
  const xs = [...new Set(bars.flatMap(b => [quantize(b[0]), quantize(b[2])]))].sort((a, b) => a - b);
  const ys = [...new Set(bars.flatMap(b => [quantize(b[1]), quantize(b[3])]))].sort((a, b) => a - b);
  const nx = xs.length - 1, ny = ys.length - 1, cells = new Uint8Array(nx * ny);
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const u = (xs[x] + xs[x + 1]) / 2, v = (ys[y] + ys[y + 1]) / 2;
      cells[y * nx + x] = bars.some(b => u > b[0] - 1e-7 && u < b[2] + 1e-7 &&
        v > b[1] - 1e-7 && v < b[3] + 1e-7) ? 1 : 0;
    }
  let pieces = 0;
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      if (!cells[y * nx + x]) continue;
      let endX = x + 1, endY = y + 1;
      while (endX < nx && cells[y * nx + endX]) endX++;
      while (endY < ny) {
        let whole = true;
        for (let col = x; col < endX; col++) if (!cells[endY * nx + col]) { whole = false; break; }
        if (!whole) break;
        endY++;
      }
      for (let row = y; row < endY; row++)
        for (let col = x; col < endX; col++) cells[row * nx + col] = 0;
      rectangle((xs[x] + xs[endX]) / 2, (ys[y] + ys[endY]) / 2,
        xs[endX] - xs[x], ys[endY] - ys[y], style === 'haitang' ? .033 : .043,
        timber, style === 'haitang' ? .028 : .041);
      pieces++;
    }
  return { style, panels, pieces };
}
