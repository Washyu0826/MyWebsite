import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// The 1px rule the layout repeats on every list, section and pager. `fade` is the tapered version
// the numbered section heads use; `strong` is the solid ink-tinted one at full width.
export const dividerVariants = cva('block h-px w-full border-0', {
  variants: {
    tone: {
      rule: 'bg-rule',
      strong: 'bg-[color-mix(in_srgb,var(--ink)_46%,var(--rule))]',
      fade: '[background-image:linear-gradient(90deg,color-mix(in_srgb,var(--ink)_46%,var(--rule)),transparent)]',
    },
    spacing: { none: '', sm: 'my-5', md: 'my-6', lg: 'my-block' },
  },
  defaultVariants: { tone: 'rule', spacing: 'none' },
});
export function Divider({ className, tone, spacing, ...props }:
  React.ComponentProps<'hr'> & VariantProps<typeof dividerVariants>) {
  return <hr aria-hidden="true" className={cn(dividerVariants({ tone, spacing }), className)} {...props} />;
}
