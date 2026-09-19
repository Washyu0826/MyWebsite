import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// The small grey line of facts under a title: date, reading time, role, tech. Wraps rather than
// truncates, because a zh label and its en counterpart rarely measure the same.
export const metaRowVariants = cva('flex min-w-0 flex-wrap items-center text-meta text-graphite', {
  variants: { density: { tight: 'gap-x-4 gap-y-1.5', loose: 'gap-x-6 gap-y-3' } },
  defaultVariants: { density: 'tight' },
});
type Props = React.ComponentProps<'div'> & VariantProps<typeof metaRowVariants> & { as?: 'div' | 'ul' };
export function MetaRow({ className, density, as: Tag = 'div', ...props }: Props) {
  // Both tags take an HTMLElement ref; the cast keeps one prop type across the union.
  const Element = Tag as 'div';
  return <Element data-slot="meta-row" className={cn(metaRowVariants({ density }), className)} {...props} />;
}
export function MetaItem({ className, label, children, ...props }:
  React.ComponentProps<'span'> & { label?: React.ReactNode }) {
  return <span className={cn('inline-flex min-w-0 items-center gap-2', className)} {...props}>
    {label ? <span className="text-graphite/80">{label}</span> : null}{children}
  </span>;
}
