import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
export const buttonVariants = cva(
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-sm px-4 py-2 text-meta font-medium disabled:pointer-events-none disabled:opacity-50',
  { variants: { variant: {
    default: 'border border-ink bg-ink text-paper hover:bg-graphite',
    outline: 'border border-rule bg-paper text-ink hover:bg-ash',
    ghost: 'text-graphite hover:bg-ash hover:text-ink',
  } }, defaultVariants: { variant: 'default' } },
);
export function Button({ className, variant, asChild = false, ...props }:
  React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, className }))} {...props} />;
}
