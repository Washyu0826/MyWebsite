// Flat continuous-stroke approximation of the brand logo.
// Shared with public/brand-logo.svg, the icons and the Open Graph images; keep them in sync.
export const BRAND_VIEWBOX = '0 0 926 1205';
export const BRAND_STROKE = 'M165 330C95 455 175 555 300 505L455 255C483 210 540 205 577 244L695 370C735 414 734 480 692 528L390 875C342 930 355 1014 421 1044L612 1130';

/**
 * Drawn inline rather than loaded as an image, so the stroke is `currentColor`: near-white on the
 * dark theme, near-black on the light one, gold on hover. A single-colour PNG could only ever suit
 * one of the two, and on the dark theme it was nearly invisible.
 */
export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return <svg className={className} viewBox={BRAND_VIEWBOX} fill="none" aria-hidden="true" focusable="false">
    <path d={BRAND_STROKE} stroke="currentColor" strokeWidth={170} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
