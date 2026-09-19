import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// The hover background is not a class: interactions.css fills each variant from the bottom,
// keyed off data-variant, so the colour arrives as a sweep rather than a swap.
// `text-meta` used to be dropped here: tailwind-merge read it as a colour and let `text-paper`
// cancel it. Fixed in lib/utils.ts by registering the theme's font-size names, not by renaming.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-sm text-meta font-medium disabled:pointer-events-none disabled:opacity-50',
  { variants: {
    variant: {
      default: 'border border-ink bg-ink text-paper',
      outline: 'border border-rule bg-paper text-ink',
      ghost: 'text-graphite hover:text-ink focus-visible:text-ink',
    },
    // md keeps the 44px touch target; sm is for the inline links that already sit inside one.
    size: { md: 'min-h-11 min-w-11 px-4 py-2', sm: 'min-h-8 px-3 py-1' },
  }, defaultVariants: { variant: 'default', size: 'md' } },
);
export function Button({ className, variant, size, asChild = false, ...props }:
  React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" data-variant={variant || 'default'} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
