// Flat approximation of the brand logo: a slanted question-mark hook plus a detached capsule dot.
// Shared with public/brand-logo.svg and the Open Graph images; keep the three in sync.
export const BRAND_VIEWBOX = '0 0 926 1205';
export const BRAND_HOOK = 'M110 290C55 420 140 560 240 505L430 190L630 350L250 990';
export const BRAND_DOT = { x: 625, y: 790, width: 190, height: 390, rx: 95, rotate: 'rotate(28 720 985)' };
export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return <svg className={className} viewBox={BRAND_VIEWBOX} aria-hidden="true" focusable="false">
    <path d={BRAND_HOOK} fill="none" stroke="currentColor" strokeWidth="175" strokeLinecap="round" strokeLinejoin="round" />
    <rect x={BRAND_DOT.x} y={BRAND_DOT.y} width={BRAND_DOT.width} height={BRAND_DOT.height} rx={BRAND_DOT.rx} transform={BRAND_DOT.rotate} fill="currentColor" />
  </svg>;
}
