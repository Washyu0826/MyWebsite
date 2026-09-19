'use client';
import { useEffect, useRef } from 'react';
// Analytic-cubism backdrop. The canvas is fractured into interlocking facets by successive line cuts,
// facets are painted in earth pigments with hatching, guide lines and arcs, and everything breathes
// slowly and shifts with the pointer. Purely decorative: static under prefers-reduced-motion, paused off-screen.
type Theme = 'light' | 'dark';
type Point = [number, number];
type Facet = {
  pts: Point[]; cx: number; cy: number; color: number; alpha: number;
  depth: number; hatch: number; hatchAngle: number; phase: number; painted: boolean;
};
// ochre, umber, prussian, oxblood, olive, sand, charcoal, cream, gold
const PALETTES: Record<Theme, string[]> = {
  light: ['#C99A3C', '#7C4F2A', '#2E4A62', '#7E2F26', '#6E6B3A', '#E5CFA0', '#23221F', '#F4EAD2', '#B9973F'],
  dark: ['#B48A3E', '#5E3E22', '#24405A', '#5E2620', '#4E4C2A', '#8B7A52', '#2A2C31', '#6D6250', '#C8B06A'],
};
const LINE: Record<Theme, string> = { light: '#23221F', dark: '#E9E1CB' };
// Reference frame is 1.6 x 1 (landscape); it is stretched to the canvas on draw.
const W = 1.6, H = 1;
const ANGLES = [1.25, -0.18, -1.05, 1.42, 0.55, 0.95, -0.6];
// Long guide lines and arcs anchoring the composition: [x, y, angle] and [x, y, r, from, to].
const GUIDES: [number, number, number][] = [[0.95, 0, 1.25], [0, 0.42, -0.18], [1.4, 1, -1.05], [0.5, 1, 1.42], [1.6, 0.2, 0.55]];
const ARCS: [number, number, number, number, number][] = [[1.18, 0.52, 0.42, 2.2, 4.4], [0.62, 0.34, 0.3, 0.1, 1.9], [1.32, 0.86, 0.5, 3.4, 4.9], [0.28, 0.72, 0.22, 4.2, 6.1]];
const FACETS = 42;
function mulberry32(seed: number) {
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
function buildFacets(): Facet[] {
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
  return polys.map(pts => {
    const [cx, cy] = centroid(pts), right = Math.max(0, Math.min(1, (cx - 0.35) / 0.9));
    const weights = [3, 2, 2, 1.5, 2, 2, 1, 2, 1.5]; // pigment frequency
    let pick = rand() * weights.reduce((s, x) => s + x, 0), color = 0;
    while (pick > weights[color]) { pick -= weights[color]; color++; }
    return {
      pts, cx, cy, color, painted: rand() < 0.82,
      alpha: (0.3 + rand() * 0.55) * (0.55 + 0.45 * right) * (color === 6 ? 0.55 : 1),
      depth: 0.15 + rand() * 0.85, hatch: rand() < 0.34 ? (rand() < 0.3 ? 2 : 1) : 0,
      hatchAngle: ANGLES[Math.floor(rand() * ANGLES.length)], phase: rand() * Math.PI * 2,
    };
  });
}
function trace(ctx: CanvasRenderingContext2D, pts: Point[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
function hatch(ctx: CanvasRenderingContext2D, cx: number, cy: number, reach: number, angle: number) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); ctx.beginPath();
  for (let y = -reach; y <= reach; y += 6) { ctx.moveTo(-reach, y); ctx.lineTo(reach, y); }
  ctx.stroke(); ctx.restore();
}
function draw(ctx: CanvasRenderingContext2D, facets: Facet[], w: number, h: number, dpr: number, t: number, px: number, py: number, theme: Theme) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const sx = w / W, sy = h / H, light = theme === 'light', palette = PALETTES[theme], line = LINE[theme];
  ctx.globalCompositeOperation = light ? 'multiply' : 'source-over';
  ctx.lineJoin = 'round';
  for (const f of facets) {
    const drift = 1 + (t ? 0.012 * Math.sin(t * 0.21 + f.phase) : 0), spin = t ? 0.008 * Math.sin(t * 0.13 + f.phase * 1.3) : 0;
    const cos = Math.cos(spin), sin = Math.sin(spin);
    const ox = f.cx * sx + px * 34 * f.depth + Math.sin(t * 0.09 + f.phase) * 5 * f.depth;
    const oy = f.cy * sy + py * 22 * f.depth + Math.cos(t * 0.11 + f.phase) * 4 * f.depth;
    const pts = f.pts.map<Point>(([x, y]) => {
      const dx = (x - f.cx) * sx * drift, dy = (y - f.cy) * sy * drift;
      return [ox + dx * cos - dy * sin, oy + dx * sin + dy * cos];
    });
    trace(ctx, pts);
    if (f.painted) {
      const sweep = 0.8 + 0.2 * Math.sin(t * 0.17 + f.cx * 4 + f.cy * 3); // slow light passing over the facets
      ctx.globalAlpha = Math.min(1, f.alpha * sweep * (light ? 1 : 0.9));
      ctx.fillStyle = palette[f.color]; ctx.fill();
    }
    ctx.globalAlpha = light ? 0.42 : 0.26; ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke();
    if (f.hatch) {
      const reach = Math.max(w, h) * 0.3;
      ctx.save(); trace(ctx, pts); ctx.clip(); ctx.globalAlpha = light ? 0.2 : 0.14; ctx.lineWidth = 0.75;
      hatch(ctx, ox, oy, reach, f.hatchAngle + spin);
      if (f.hatch === 2) hatch(ctx, ox, oy, reach, f.hatchAngle + spin + Math.PI / 2);
      ctx.restore();
    }
  }
  // Guide lines and arcs sit on top, like the pencil construction left visible in the painting.
  ctx.strokeStyle = line; ctx.lineWidth = 0.9; ctx.globalAlpha = light ? 0.3 : 0.2;
  const reach = Math.max(w, h) * 2;
  GUIDES.forEach(([x, y, base], i) => {
    const a = base + Math.sin(t * 0.05 + i) * 0.025, ox = x * sx + px * 12, oy = y * sy + py * 12;
    ctx.beginPath(); ctx.moveTo(ox - Math.cos(a) * reach, oy - Math.sin(a) * reach); ctx.lineTo(ox + Math.cos(a) * reach, oy + Math.sin(a) * reach); ctx.stroke();
  });
  ctx.lineWidth = 1.2;
  ARCS.forEach(([x, y, r, from, to], i) => {
    const wob = Math.sin(t * 0.08 + i * 1.7) * 0.06;
    ctx.beginPath(); ctx.arc(x * sx + px * 20, y * sy + py * 14, r * Math.min(sx, sy), from + wob, to + wob); ctx.stroke();
  });
}
export function CubistBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, host = canvas?.parentElement, ctx = canvas?.getContext('2d');
    if (!canvas || !host || !ctx) return;
    const facets = buildFacets();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const readTheme = (): Theme => document.documentElement.classList.contains('light') ? 'light' : 'dark';
    const pointer = { x: 0, y: 0 }, eased = { x: 0, y: 0 };
    let w = 0, h = 0, dpr = 1, theme = readTheme(), raf = 0, running = false, visible = true;
    const start = performance.now();
    const render = () => draw(ctx, facets, w, h, dpr, reduce.matches ? 0 : (performance.now() - start) / 1000, eased.x, eased.y, theme);
    const frame = () => {
      eased.x += (pointer.x - eased.x) * 0.04; eased.y += (pointer.y - eased.y) * 0.04;
      render(); raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      const should = visible && !reduce.matches && !document.hidden;
      if (should && !running) { running = true; raf = requestAnimationFrame(frame); }
      else if (!should && running) { running = false; cancelAnimationFrame(raf); render(); }
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      w = rect.width; h = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      render();
    };
    const onPointer = (e: PointerEvent) => { pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5; };
    const onTheme = () => { theme = readTheme(); if (!running) render(); };
    const sizer = new ResizeObserver(resize); sizer.observe(host);
    const watcher = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }); watcher.observe(host);
    const themer = new MutationObserver(onTheme); themer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', sync);
    reduce.addEventListener('change', sync);
    sync();
    return () => {
      cancelAnimationFrame(raf); sizer.disconnect(); watcher.disconnect(); themer.disconnect();
      window.removeEventListener('pointermove', onPointer); document.removeEventListener('visibilitychange', sync); reduce.removeEventListener('change', sync);
    };
  }, []);
  return <div className="cubist-backdrop" aria-hidden="true"><canvas ref={ref} /></div>;
}
