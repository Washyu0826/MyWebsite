import Image from 'next/image';

// Flat continuous-stroke approximation of the brand logo.
// Shared with public/brand-logo.svg and the Open Graph images; keep them in sync.
export const BRAND_VIEWBOX = '0 0 926 1205';
export const BRAND_STROKE = 'M165 330C95 455 175 555 300 505L455 255C483 210 540 205 577 244L695 370C735 414 734 480 692 528L390 875C342 930 355 1014 421 1044L612 1130';

/**
 * The same artwork in two inks. The original file is the light-theme mark and is untouched; the
 * dark-theme one is the identical image with its ink replaced and its alpha kept, so the shape is
 * the same drawing rather than a redrawing of it. CSS picks one, because the theme is a class on
 * <html> that the server does not know at render time.
 */
export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return <span className={`${className} brand-mark-pair`}>
    <Image className="brand-mark-dark" src="/brand-logo-header-light.png" alt="" width={256} height={221} sizes="32px" priority aria-hidden="true" />
    <Image className="brand-mark-light" src="/brand-logo-header.png" alt="" width={256} height={221} sizes="32px" priority aria-hidden="true" />
  </span>;
}
