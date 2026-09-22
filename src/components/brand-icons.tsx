import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * LINE.
 *
 * lucide has no LINE icon, and the speech bubble standing in for it named no service in particular.
 * This is LINE's balloon - a rounded, slightly squared bubble with the tail dropping from its foot -
 * drawn in the same outline weight as the lucide icons beside it, so the row of channels stays one
 * set rather than one brand mark among drawings. The wordmark is not reproduced: at this size it
 * would be an illegible smudge, and the silhouette is what people recognise anyway.
 */
export function LineIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 3C6.48 3 2 6.6 2 11.05c0 3.99 3.55 7.33 8.35 7.96.33.07.77.22.88.49.1.24.07.62.03.87l-.14.85c-.04.25-.2 1 .88.54 1.08-.45 5.8-3.42 7.92-5.85C21.39 14.3 22 12.77 22 11.05 22 6.6 17.52 3 12 3z" />
    </svg>
  );
}
