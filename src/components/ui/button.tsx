import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// The hover background is not a class: interactions.css fills each variant from the bottom,
// keyed off data-variant, so the colour arrives as a sweep rather than a swap.
export const buttonVariants = cva(
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-sm px-4 py-2 text-meta font-medium disabled:pointer-events-none disabled:opacity-50',
  { variants: { variant: {
    default: 'border border-ink bg-ink text-paper',
    outline: 'border border-rule bg-paper text-ink',
    ghost: 'text-graphite hover:text-ink focus-visible:text-ink',
  } }, defaultVariants: { variant: 'default' } },
);
export function Button({ className, variant, asChild = false, ...props }:
  React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" data-variant={variant || 'default'} className={cn(buttonVariants({ variant, className }))} {...props} />;
}
