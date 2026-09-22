/**
 * Geometry for the cubist plates that stand in the gutters of the listing pages.
 *
 * The homepage paints its backdrop on a canvas, which is the right tool for a wide plate with a
 * pointer light and forty-odd facets redrawn thirty times a second. The gutters need the opposite:
 * two tall, narrow plates that must render before any script runs, cost nothing per frame, and move
 * only with the scroll. So the composition is computed once here, at module load, and emitted as
 * SVG the server can send; everything that moves afterwards is a compositor transform.
 *
 * The construction is the same as the canvas one: a rectangle cut again and again by lines at a
 * fixed set of angles, largest piece first, from a fixed seed, so the drawing is identical on every
 * visit and on both the server and the client. On top of the facets sit the marks analytic cubism
 * is actually made of - construction lines running past the edges of the shapes they describe, arcs
 * swung from centres off the plate, and hatching across a few of the receding planes.
 */
export type Point = [number, number];

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The plate's own coordinates. Tall and narrow: it is drawn for a gutter, not a page. */
export const PLATE_W = 200;
export const PLATE_H = 900;
const FACETS = 17;

// Every cut, every hatch and every guide line is at one of these angles, which is what keeps a
// composition made of random pieces from looking random.
const ANGLES = [1.18, -0.92, 0.46, -0.38, 1.42, -1.28, 0.78];
// Construction lines: [x, y, angle] in fractions of the plate, extended to both edges.
const GUIDES: [number, number, number][] = [
  [0.2, 0.03, 1.18],
  [0.88, 0.21, -0.92],
  [0.04, 0.55, 0.46],
  [0.74, 0.63, 1.42],
  [0.36, 0.88, -0.38],
  [0.6, 0.34, 1.28],
];
// Arcs swung from centres mostly off the plate: [x, y, radius, from, to]; radius in plate widths.
const ARCS: [number, number, number, number, number][] = [
  [0.9, 0.14, 0.62, 1.5, 4.3],
  [0.08, 0.44, 0.78, -0.7, 1.6],
  [0.72, 0.8, 0.54, 2.3, 5.2],
  [0.3, 0.68, 0.36, 3.6, 6.0],
];
// Pigment slots, resolved to colours by CSS so each theme gets its own. A handful of facets carry
// the foreground; the rest recede.
const KEY_PIGMENTS = [0, 3, 1, 0];
const BACK_PIGMENTS = [2, 4, 5, 1, 4, 5];

const round = (n: number) => Math.round(n * 100) / 100;

function area(p: Point[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function centroid(p: Point[]): Point {
  return [p.reduce((s, [x]) => s + x, 0) / p.length, p.reduce((s, [, y]) => s + y, 0) / p.length];
}

/** Cuts a convex polygon with the line through (px, py) at `angle`; returns both halves. */
function cut(poly: Point[], px: number, py: number, angle: number): [Point[], Point[]] {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const side = ([x, y]: Point) => dx * (y - py) - dy * (x - px);
  const a: Point[] = [];
  const b: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    (sp >= 0 ? a : b).push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      const m: Point = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      a.push(m);
      b.push(m);
    }
  }
  return [a, b];
}

/** Liang-Barsky: the span of the line through (px, py) that lies inside the plate. */
export function clipLine(px: number, py: number, angle: number, w = PLATE_W, h = PLATE_H): [Point, Point] | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let t0 = -Infinity;
  let t1 = Infinity;
  const edges: [number, number][] = [
    [-dx, px],
    [dx, w - px],
    [-dy, py],
    [dy, h - py],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null;
  return [
    [px + dx * t0, py + dy * t0],
    [px + dx * t1, py + dy * t1],
  ];
}

const path = (pts: Point[]) => `M${pts.map(([x, y]) => `${round(x)},${round(y)}`).join('L')}Z`;

export type PlateFacet = {
  d: string;
  /** Index into the six pigment slots the stylesheet defines. */
  pigment: number;
  alpha: number;
  /** 0 is furthest back; the three layers are what the parallax moves separately. */
  layer: 0 | 1 | 2;
  hatch: boolean;
  /** Seconds. Fixed per facet, so nothing on the plate breathes in step with anything else. */
  sway: number;
  lag: number;
  shift: [number, number];
};
export type PlateLine = { d: string; length: number; layer: 0 | 1 | 2; period: number; lag: number };
export type PlateArc = { d: string; layer: 0 | 1 | 2; alpha: number };
export type Plate = { facets: PlateFacet[]; lines: PlateLine[]; arcs: PlateArc[] };

export function buildPlate(seed: number): Plate {
  const rand = mulberry32(seed);
  const polys: Point[][] = [
    [
      [0, 0],
      [PLATE_W, 0],
      [PLATE_W, PLATE_H],
      [0, PLATE_H],
    ],
  ];
  let guard = 0;
  while (polys.length < FACETS && guard++ < 600) {
    polys.sort((p, q) => area(q) - area(p));
    const i = Math.floor(rand() * Math.min(3, polys.length));
    const poly = polys[i];
    const [cx, cy] = centroid(poly);
    const v = poly[Math.floor(rand() * poly.length)];
    const k = 0.5 + rand() * 0.35;
    const angle = ANGLES[Math.floor(rand() * ANGLES.length)] + (rand() - 0.5) * 0.3;
    const [a, b] = cut(poly, cx * k + v[0] * (1 - k), cy * k + v[1] * (1 - k), angle);
    const floor = PLATE_W * PLATE_H * 0.012;
    if (a.length < 3 || b.length < 3 || area(a) < floor || area(b) < floor) continue;
    polys.splice(i, 1, a, b);
  }

  const facets: PlateFacet[] = polys.map(pts => {
    // The plate is pinned to the viewport, so its top band is always the one beside the page's
    // heading - the emptiest part of the screen and the first thing seen. The composition is
    // weighted into it: a facet up there is likelier to be a foreground plane and carries more
    // pigment either way, and the drawing thins out towards the foot.
    const high = 1 - centroid(pts)[1] / PLATE_H;
    const key = rand() < 0.17 + 0.22 * high;
    const layer: 0 | 1 | 2 = key ? 2 : rand() < 0.5 ? 0 : 1;
    const pigment = key
      ? KEY_PIGMENTS[Math.floor(rand() * KEY_PIGMENTS.length)]
      : BACK_PIGMENTS[Math.floor(rand() * BACK_PIGMENTS.length)];
    return {
      d: path(pts),
      pigment,
      // The foreground planes carry real pigment and the rest are barely there, so the plate reads
      // as a few shapes in front of a haze rather than a patchwork of equals.
      alpha: round(Math.min(0.3, (key ? 0.16 + rand() * 0.1 : 0.05 + rand() * 0.08) * (0.72 + 0.62 * high))),
      layer,
      hatch: !key && rand() < 0.34,
      sway: round(16 + rand() * 14),
      lag: round(rand() * 0.7),
      shift: [round((rand() - 0.5) * 7), round((rand() - 0.5) * 9)],
    };
  });

  const lines: PlateLine[] = [];
  GUIDES.forEach(([x, y, angle], i) => {
    const span = clipLine(x * PLATE_W, y * PLATE_H, angle);
    if (!span) return;
    const [[x0, y0], [x1, y1]] = span;
    lines.push({
      d: `M${round(x0)},${round(y0)}L${round(x1)},${round(y1)}`,
      length: Math.ceil(Math.hypot(x1 - x0, y1 - y0)),
      layer: (i % 3) as 0 | 1 | 2,
      period: round(17 + rand() * 11),
      lag: round(rand() * 9),
    });
  });

  const arcs: PlateArc[] = ARCS.map(([x, y, r, from, to], i) => {
    const cx = x * PLATE_W;
    const cy = y * PLATE_H;
    const radius = r * PLATE_W;
    const sweep = to - from;
    const p0 = `${round(cx + radius * Math.cos(from))},${round(cy + radius * Math.sin(from))}`;
    const p1 = `${round(cx + radius * Math.cos(to))},${round(cy + radius * Math.sin(to))}`;
    return {
      d: `M${p0}A${round(radius)},${round(radius)} 0 ${sweep > Math.PI ? 1 : 0} 1 ${p1}`,
      layer: (i % 3) as 0 | 1 | 2,
      alpha: round(0.14 + rand() * 0.12),
    };
  });

  // Back to front: the receding layers paint first, and inside a layer the order is the order the
  // cuts made, which is what interlocks them.
  facets.sort((a, b) => a.layer - b.layer);
  return { facets, lines, arcs };
}

/* --- the line work that crosses the middle ---------------------------------- */
/* Only lines and arcs, never a filled plane: they are a pixel wide, so they can run behind a column
   of text without any row being read through a tint. Drawn in the listing's own proportions, at the
   same angles the plates are cut on, so the two gutters read as one picture with the page between
   them rather than as two pictures with a gap. Nothing here moves. */
export const SPAN_W = 1200;
export const SPAN_H = 900;
const SPAN_GUIDES: [number, number, number][] = [
  [0.06, 0.08, 0.46],
  [0.52, 0.02, -0.38],
  [0.88, 0.18, 1.18],
  [0.2, 0.52, -0.92],
  [0.74, 0.58, 0.78],
  [0.34, 0.86, 0.46],
  [0.94, 0.78, -1.28],
];
const SPAN_ARCS: [number, number, number, number, number][] = [
  [0.3, -0.12, 0.42, 0.4, 2.6],
  [0.82, 0.64, 0.5, 2.6, 5.2],
  [-0.05, 0.4, 0.36, -0.8, 1.4],
];

export function buildSpan(seed: number): { lines: PlateLine[]; arcs: PlateArc[] } {
  const rand = mulberry32(seed);
  const lines: PlateLine[] = [];
  SPAN_GUIDES.forEach(([x, y, angle], i) => {
    const span = clipLine(x * SPAN_W, y * SPAN_H, angle, SPAN_W, SPAN_H);
    if (!span) return;
    const [[x0, y0], [x1, y1]] = span;
    lines.push({
      d: `M${round(x0)},${round(y0)}L${round(x1)},${round(y1)}`,
      length: Math.ceil(Math.hypot(x1 - x0, y1 - y0)),
      layer: (i % 3) as 0 | 1 | 2,
      period: 0,
      lag: 0,
    });
  });
  const arcs: PlateArc[] = SPAN_ARCS.map(([x, y, r, from, to]) => {
    const cx = x * SPAN_W;
    const cy = y * SPAN_H;
    const radius = r * SPAN_W;
    const p0 = `${round(cx + radius * Math.cos(from))},${round(cy + radius * Math.sin(from))}`;
    const p1 = `${round(cx + radius * Math.cos(to))},${round(cy + radius * Math.sin(to))}`;
    return { d: `M${p0}A${round(radius)},${round(radius)} 0 ${to - from > Math.PI ? 1 : 0} 1 ${p1}`, layer: 0, alpha: round(0.5 + rand() * 0.4) };
  });
  return { lines, arcs };
}
