import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
// tailwind-merge guesses what `text-*` means: anything that is not a known font size falls into its
// text-colour group, so `text-meta` was treated as a colour and cancelled by `text-paper` in the same
// cn() call — every button silently inherited its font size. Registering the theme's own scale names
// (and the other custom namespaces from globals.css) puts each class back in the group it belongs to.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'body', 'body-lg', 'meta', 'micro', 'nano', 'mono'] }],
      leading: [{ leading: ['body', 'heading'] }],
      tracking: [{ tracking: ['body', 'caps'] }],
      shadow: [{ shadow: ['raised', 'panel', 'overlay'] }],
      ease: [{ ease: ['standard', 'emphasized', 'inout'] }],
    },
  },
});
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
