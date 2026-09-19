import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// One shape for every keyword chip: article tags (#), tech-stack words, and the bordered filter and
// status pills. The `#` is a pseudo-element so it stays out of the accessible name.
export const tagVariants = cva('inline-flex min-w-0 items-center gap-2', {
  variants: {
    variant: {
      plain: 'text-meta text-ink',
      muted: 'text-meta text-graphite',
      hash: "text-meta text-graphite before:content-['#']",
      pill: 'min-h-7 rounded-full border border-rule px-2.5 py-1 text-micro text-graphite whitespace-nowrap',
      solid: 'min-h-7 rounded-sm border border-rule bg-ash px-3 py-1 text-micro text-ink whitespace-nowrap',
    },
  },
  defaultVariants: { variant: 'muted' },
});
export function Tag({ className, variant, asChild = false, ...props }:
  React.ComponentProps<'span'> & VariantProps<typeof tagVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';
  return <Comp data-slot="tag" className={cn(tagVariants({ variant }), className)} {...props} />;
}
