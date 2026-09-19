'use client';
import { useEffect, useRef } from 'react';
// Analytic-cubism backdrop. The canvas is fractured into interlocking facets by successive line cuts from a
// fixed seed, painted in earth pigments with hatching, guide lines and arcs. Three quiet motion layers keep it
// alive (facet drift, a diagonal light sweep, construction lines redrawing themselves), the pointer adds
// depth parallax plus a soft light, and the whole plate lags the page on scroll. Purely decorative: the full
// composition still renders, completely static, under prefers-reduced-motion, and it pauses off-screen.
type Theme = 'light' | 'dark';
type Point = [number, number];
type RGB = [number, number, number];
type Facet = {
  pts: Float64Array; buf: Float64Array; cx: number; cy: number; radius: number;
  color: number; alpha: Record<Theme, number>; depth: number; facing: number; painted: boolean;
  hatch: number; hatchAngle: number; phase: number; rate: number; delay: number;
};
type View = {
  w: number; h: number; dpr: number; t: number; px: number; py: number;
  mx: number; my: number; glow: number; theme: Theme; still: boolean;
};
// ochre, umber, prussian, oxblood, olive, sand, charcoal, cream, gold
const PALETTES: Record<Theme, string[]> = {
  light: ['#C4881B', '#6E3B12', '#1B3A5B', '#7E2614', '#6B6A28', '#D8B678', '#51402E', '#EDDDB6', '#A67A14'],
  dark: ['#CB9743', '#734B29', '#2A4E71', '#7E3129', '#605E32', '#AD9463', '#1B1E23', '#93856A', '#E0C47E'],
};
const HILITE: Record<Theme, RGB> = { light: [255, 253, 243], dark: [246, 233, 200] };
const LINE: Record<Theme, string> = { light: '#2E2318', dark: '#E9E1CB' }; // warm ink, not neutral black
// Reference frame is 1.6 x 1 (landscape); it is stretched to the canvas on draw.
const W = 1.6, H = 1;
const ANGLES = [1.25, -0.18, -1.05, 1.42, 0.55, 0.95, -0.6];
// Long guide lines and arcs anchoring the composition: [x, y, angle] and [x, y, r, from, to].
const GUIDES: [number, number, number][] = [[0.95, 0, 1.25], [0, 0.42, -0.18], [1.4, 1, -1.05], [0.5, 1, 1.42], [1.6, 0.2, 0.55]];
const ARCS: [number, number, number, number, number][] = [[1.18, 0.52, 0.42, 2.2, 4.4], [0.62, 0.34, 0.3, 0.1, 1.9], [1.32, 0.86, 0.5, 3.4, 4.9], [0.28, 0.72, 0.22, 4.2, 6.1]];
const FACETS = 42;
// Pigments carrying the foreground vs. the ones that recede, so a handful of facets read as near.
const KEY_PIGMENTS = [0, 3, 2, 8, 0, 3];
const BACK_PIGMENTS = [1, 5, 7, 4, 1, 5, 6, 7];
// Entrance: facets push open outward from this point, the last one starting at SPREAD seconds.
const FOCUS: Point = [1.04, 0.44];
const SPREAD = 0.74, OPEN = 0.46, SETTLE = SPREAD + OPEN + 0.9;
// Light sweep: a soft diagonal band crossing the plate once every SWEEP seconds.
const SWEEP = 28, SWA = -0.62, SWX = Math.cos(SWA), SWY = Math.sin(SWA), BAND = 0.36;
const SW0 = Math.min(0, H * SWY) - 0.75, SW1 = Math.max(0, W * SWX) + 0.75;
// Construction lines redraw themselves on this loop.
const GROW = 34;
const FULL: [number, number] = [1, 1];
const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// Same pigment weight seen through each theme: the gamma lifts the recessive facets without touching the foreground.
const weigh = (a: number): Record<Theme, number> => ({ light: Math.min(1, a ** 0.55 * 1.1), dark: Math.min(1, a ** 0.86) });
const ease = (x: number) => 1 - (1 - x) ** 3;
export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function area(p: Point[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}
function centroid(p: Point[]): Point {
  return [p.reduce((s, [x]) => s + x, 0) / p.length, p.reduce((s, [, y]) => s + y, 0) / p.length];
}
// Cuts a convex polygon with the line through (px, py) at `angle`; returns both halves.
function cut(poly: Point[], px: number, py: number, angle: number): [Point[], Point[]] {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const side = ([x, y]: Point) => dx * (y - py) - dy * (x - px);
  const a: Point[] = [], b: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    (sp >= 0 ? a : b).push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq), m: Point = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      a.push(m); b.push(m);
    }
  }
  return [a, b];
}
// One long loop per construction line: it draws itself in, holds, then fades out again.
export function growth(p: number): [number, number] {
  const q = p - Math.floor(p);
  return [q < 0.34 ? ease(q / 0.34) : 1, q < 0.05 ? q / 0.05 : q > 0.76 ? clamp(1 - (q - 0.76) / 0.24) : 1];
}
// The plate lags the page and fades as the hero leaves, so the sections below stay clean.
export function scrollDepth(y: number, h: number) {
  const f = clamp(1 - (y - h * 0.1) / (h * 0.72));
  return { shift: y * 0.22, fade: f * f * (3 - 2 * f) };
}
export function buildFacets(): Facet[] {
  const rand = mulberry32(1907); // fixed seed so the composition is the same on every visit
  const polys: Point[][] = [[[-0.05, -0.05], [W + 0.05, -0.05], [W + 0.05, H + 0.05], [-0.05, H + 0.05]]];
  while (polys.length < FACETS) {
    polys.sort((p, q) => area(q) - area(p));
    const i = Math.floor(rand() * Math.min(3, polys.length));
    const poly = polys[i], [cx, cy] = centroid(poly), v = poly[Math.floor(rand() * poly.length)];
    const k = 0.5 + rand() * 0.35, px = cx * k + v[0] * (1 - k), py = cy * k + v[1] * (1 - k);
    const angle = ANGLES[Math.floor(rand() * ANGLES.length)] + (rand() - 0.5) * 0.3;
    const [a, b] = cut(poly, px, py, angle);
    if (a.length < 3 || b.length < 3 || area(a) < 0.008 || area(b) < 0.008) continue;
    polys.splice(i, 1, a, b);
  }
  const facets = polys.map(pts => {
    const [cx, cy] = centroid(pts), right = clamp((cx - 0.28) / 0.95);
    const key = rand() < 0.19; // a few facets carry the foreground, the rest recede
    const depth = key ? 0.74 + rand() * 0.26 : 0.06 + rand() * 0.44;
    const color = key ? KEY_PIGMENTS[Math.floor(rand() * KEY_PIGMENTS.length)] : BACK_PIGMENTS[Math.floor(rand() * BACK_PIGMENTS.length)];
    let radius = 0, tilt = 0, longest = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i], [qx, qy] = pts[(i + 1) % pts.length], e = Math.hypot(qx - x, qy - y);
      radius = Math.max(radius, Math.hypot(x - cx, y - cy));
      if (e > longest) { longest = e; tilt = Math.atan2(qy - y, qx - x); }
    }
    return {
      pts: Float64Array.from(pts.flat()), buf: new Float64Array(pts.length * 2), cx, cy, radius, color, depth,
      // Pigment weight per theme: the light plate needs more body on paper, the dark one more restraint.
      alpha: weigh(key ? 0.8 + rand() * 0.2 : (0.11 + rand() * 0.36) * (0.42 + 0.58 * right) * (color === 6 ? 0.72 : 1)),
      // How squarely the facet faces the sweep, like a plane of a metal relief catching the light.
      facing: 0.4 + 0.6 * (0.5 + 0.5 * Math.cos(2 * (tilt - SWA))),
      painted: key || rand() < 0.86, hatch: key ? 0 : rand() < 0.36 ? (rand() < 0.3 ? 2 : 1) : 0,
      hatchAngle: ANGLES[Math.floor(rand() * ANGLES.length)], phase: rand() * Math.PI * 2,
      rate: 0.157 + rand() * 0.157, // one drift cycle per 20-40s
      delay: Math.hypot(cx - FOCUS[0], (cy - FOCUS[1]) * 1.3),
    };
  });
  const far = Math.max(...facets.map(f => f.delay));
  for (const f of facets) f.delay = (f.delay / far) * SPREAD;
  return facets.sort((a, b) => a.depth - b.depth); // near facets paint last, over the ones behind
}
function trace(ctx: CanvasRenderingContext2D, b: Float64Array) {
  ctx.beginPath();
  ctx.moveTo(b[0], b[1]);
  for (let i = 2; i < b.length; i += 2) ctx.lineTo(b[i], b[i + 1]);
  ctx.closePath();
}
function hatch(ctx: CanvasRenderingContext2D, cx: number, cy: number, reach: number, angle: number) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); ctx.beginPath();
  for (let y = -reach; y <= reach; y += 6) { ctx.moveTo(-reach, y); ctx.lineTo(reach, y); }
  ctx.stroke(); ctx.restore();
}
const mix = (c: RGB, hi: RGB, k: number) =>
  `rgb(${Math.round(c[0] + (hi[0] - c[0]) * k)},${Math.round(c[1] + (hi[1] - c[1]) * k)},${Math.round(c[2] + (hi[2] - c[2]) * k)})`;
const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const RGBS: Record<Theme, RGB[]> = { light: PALETTES.light.map(rgb), dark: PALETTES.dark.map(rgb) };
function draw(ctx: CanvasRenderingContext2D, facets: Facet[], v: View) {
  const { w, h, t, still } = v;
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // The frame is fitted like object-fit: cover, so a narrow viewport gets a crop of the painting, not a squashed one.
  const s = Math.max(w / W, h / H), fx = (w - W * s) * 0.34, fy = (h - H * s) * 0.5;
  const light = v.theme === 'light', palette = PALETTES[v.theme], rgbs = RGBS[v.theme], hi = HILITE[v.theme], line = LINE[v.theme];
  const band = SW0 + (SW1 - SW0) * ((t / SWEEP) % 1), glow2 = (Math.max(w, h) * 0.26) ** 2;
  // On paper the highlight works by lifting pigment off, so it has to stay much quieter than on the dark plate.
  const lit = light ? 0.5 : 1;
  ctx.globalCompositeOperation = light ? 'multiply' : 'source-over';
  ctx.lineJoin = 'round';
  for (const f of facets) {
    const open = still ? 1 : ease(clamp((t - f.delay) / OPEN));
    if (open <= 0) continue;
    // Facet drift: a slow translation and a rotation about the facet's own centroid, each on its own phase.
    const live = still ? 0 : open;
    const spin = live * 0.014 * Math.sin(t * f.rate + f.phase);
    const grow = 0.46 + 0.54 * open + live * 0.007 * Math.sin(t * f.rate * 0.7 + f.phase * 1.7);
    const back = 1 - open;
    const ox = fx + f.cx * s + back * (FOCUS[0] - f.cx) * s * 0.4 + v.px * (10 + 40 * f.depth) + live * Math.sin(t * f.rate * 0.83 + f.phase) * 5.5 * f.depth;
    const oy = fy + f.cy * s + back * (FOCUS[1] - f.cy) * s * 0.4 + v.py * (7 + 26 * f.depth) + live * Math.cos(t * f.rate * 0.61 + f.phase * 1.4) * 4.2 * f.depth;
    const cos = Math.cos(spin) * grow, sin = Math.sin(spin) * grow, p = f.pts, b = f.buf;
    for (let i = 0; i < p.length; i += 2) {
      const dx = (p[i] - f.cx) * s, dy = (p[i + 1] - f.cy) * s;
      b[i] = ox + dx * cos - dy * sin; b[i + 1] = oy + dx * sin + dy * cos;
    }
    const u = (f.cx * SWX + f.cy * SWY - band) / BAND;
    const sweep = still ? 0 : Math.exp(-u * u) * f.facing;
    const mx = ox - v.mx, my = oy - v.my;
    const cursor = v.glow > 0.003 ? v.glow * Math.exp(-(mx * mx + my * my) / glow2) : 0;
    const lift = Math.min(1, sweep * 0.72 + cursor);
    trace(ctx, b);
    if (f.painted) {
      ctx.globalAlpha = Math.min(1, f.alpha[v.theme] * open * (1 + 0.2 * lift * lit));
      ctx.fillStyle = lift > 0.02 ? mix(rgbs[f.color], hi, lift * 0.4 * lit) : palette[f.color];
      ctx.fill();
    }
    ctx.globalAlpha = ((light ? 0.22 : 0.14) + (light ? 0.34 : 0.3) * f.depth) * open * (1 + 0.5 * lift * lit);
    ctx.strokeStyle = line; ctx.lineWidth = f.depth > 0.7 ? 1.2 : 0.9; ctx.stroke();
    if (f.hatch) {
      ctx.save(); ctx.clip(); ctx.globalAlpha = (light ? 0.15 : 0.14) * open; ctx.lineWidth = 0.75;
      const reach = f.radius * s * grow + 6;
      hatch(ctx, ox, oy, reach, f.hatchAngle + spin);
      if (f.hatch === 2) hatch(ctx, ox, oy, reach, f.hatchAngle + spin + Math.PI / 2);
      ctx.restore();
    }
  }
  // Guide lines and arcs sit on top, like the pencil construction left visible in the painting.
  const drawn = still ? 1 : clamp((t - SPREAD) / 0.8), reach = Math.max(w, h) * 2;
  if (drawn <= 0) return;
  ctx.strokeStyle = line; ctx.lineWidth = 0.9;
  GUIDES.forEach(([x, y, base], i) => {
    const [len, fade] = still ? FULL : growth(t / GROW + i * 0.17);
    if (fade <= 0) return;
    const a = base + (still ? 0 : Math.sin(t * 0.05 + i) * 0.022), r = reach * len;
    const gx = fx + x * s + v.px * 14, gy = fy + y * s + v.py * 10;
    ctx.globalAlpha = (light ? 0.3 : 0.2) * fade * drawn;
    ctx.beginPath(); ctx.moveTo(gx - Math.cos(a) * r, gy - Math.sin(a) * r); ctx.lineTo(gx + Math.cos(a) * r, gy + Math.sin(a) * r); ctx.stroke();
  });
  ctx.lineWidth = 1.2;
  ARCS.forEach(([x, y, r, from, to], i) => {
    const [len, fade] = still ? FULL : growth(t / GROW + 0.42 + i * 0.19);
    if (fade <= 0) return;
    const wob = still ? 0 : Math.sin(t * 0.08 + i * 1.7) * 0.05;
    ctx.globalAlpha = (light ? 0.32 : 0.22) * fade * drawn;
    ctx.beginPath(); ctx.arc(fx + x * s + v.px * 20, fy + y * s + v.py * 14, r * s, from + wob, from + wob + (to - from) * len); ctx.stroke();
  });
}
/** Runs `job` on the first idle slice, falling back to a short timeout. Returns a canceller. */
function whenIdle(job: () => void): () => void {
  const request = typeof requestIdleCallback === 'function' ? requestIdleCallback : null;
  if (request) {
    const handle = request(job, { timeout: 1200 });
    return () => cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(job, 200);
  return () => window.clearTimeout(handle);
}

/** Wires the canvas up and starts drawing. Returns the teardown for everything it attached. */
function startBackdrop(canvas: HTMLCanvasElement | null): () => void {
  const host = canvas?.parentElement, ctx = canvas?.getContext('2d');
  if (!canvas || !host || !ctx) return () => {};
  {
    const facets = buildFacets();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const readTheme = (): Theme => (document.documentElement.classList.contains('light') ? 'light' : 'dark');
    // The intro only plays on the first view of the session; the layout marks the rest as 'seen'.
    const seen = document.documentElement.dataset.js === 'seen';
    const start = performance.now() - (seen ? SETTLE * 1000 : 0);
    const pointer = { x: 0, y: 0, cx: -1e4, cy: -1e4, glow: 0 };
    const eased = { x: 0, y: 0, cx: -1e4, cy: -1e4, glow: 0 };
    const v: View = { w: 0, h: 0, dpr: 1, t: 0, px: 0, py: 0, mx: -1e4, my: -1e4, glow: 0, theme: readTheme(), still: reduce.matches };
    let top = 0, scroll = 0, shift = 0, raf = 0, running = false, visible = true, slow = 0, tick = 0;
    const render = () => {
      v.t = (performance.now() - start) / 1000;
      v.still = reduce.matches;
      v.px = v.still ? 0 : eased.x; v.py = v.still ? 0 : eased.y;
      v.mx = eased.cx; v.my = eased.cy - (top - scroll) - shift; v.glow = v.still ? 0 : eased.glow;
      draw(ctx, facets, v);
    };
    const drift = () => {
      const d = v.still ? { shift: 0, fade: 1 } : scrollDepth(scroll, v.h || 1);
      shift = d.shift;
      canvas.style.transform = `translate3d(0,${d.shift.toFixed(1)}px,0)`;
      canvas.style.opacity = d.fade.toFixed(3);
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (slow > 6 && tick++ % 2) return; // struggling: halve the update rate, never freeze
      const started = performance.now();
      eased.x += (pointer.x - eased.x) * 0.045; eased.y += (pointer.y - eased.y) * 0.045;
      eased.cx += (pointer.cx - eased.cx) * 0.09; eased.cy += (pointer.cy - eased.cy) * 0.09;
      eased.glow += (pointer.glow - eased.glow) * 0.05;
      render();
      slow = performance.now() - started > 13 ? slow + 1 : Math.max(0, slow - 1);
    };
    const sync = () => {
      const should = visible && !reduce.matches && !document.hidden;
      if (should && !running) { running = true; slow = 0; raf = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; cancelAnimationFrame(raf); drift(); render(); }
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      v.w = rect.width; v.h = rect.height; v.dpr = Math.min(window.devicePixelRatio || 1, 2);
      top = rect.top + window.scrollY; scroll = window.scrollY;
      canvas.width = Math.round(v.w * v.dpr); canvas.height = Math.round(v.h * v.dpr);
      drift(); render();
    };
    const onScroll = () => { scroll = window.scrollY; drift(); };
    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5;
      pointer.cx = e.clientX; pointer.cy = e.clientY; pointer.glow = 1;
    };
    const onLeave = () => { pointer.x = 0; pointer.y = 0; pointer.glow = 0; };
    const onTheme = () => { v.theme = readTheme(); if (!running) render(); };
    const sizer = new ResizeObserver(resize); sizer.observe(host);
    const watcher = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }); watcher.observe(host);
    const themer = new MutationObserver(onTheme); themer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('blur', onLeave);
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', sync);
    reduce.addEventListener('change', sync);
    sync();
    return () => {
      cancelAnimationFrame(raf); sizer.disconnect(); watcher.disconnect(); themer.disconnect();
      window.removeEventListener('pointermove', onPointer); window.removeEventListener('scroll', onScroll);
      window.removeEventListener('blur', onLeave); document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', sync); reduce.removeEventListener('change', sync);
    };
  }
}

export function CubistBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    // Building 42 facets and starting the loop during hydration lands squarely in the window
    // Lighthouse measures as blocking time, and the backdrop is decorative. Wait for the first
    // idle slice so the text paints and becomes interactive first, then assemble the picture.
    let stop = () => {};
    const cancel = whenIdle(() => { stop = startBackdrop(ref.current); });
    return () => { cancel(); stop(); };
  }, []);
  return <div className="cubist-backdrop" aria-hidden="true"><canvas ref={ref} /></div>;
}
