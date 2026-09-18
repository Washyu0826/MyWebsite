import Image from 'next/image';

// Flat continuous-stroke approximation of the brand logo.
// Shared with public/brand-logo.svg and the Open Graph images; keep them in sync.
export const BRAND_VIEWBOX = '0 0 926 1205';
export const BRAND_STROKE = 'M165 330C95 455 175 555 300 505L455 255C483 210 540 205 577 244L695 370C735 414 734 480 692 528L390 875C342 930 355 1014 421 1044L612 1130';
export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return <Image className={className} src="/brand-logo-header.png" alt="" width={256} height={221} sizes="32px" priority aria-hidden="true" />;
}
