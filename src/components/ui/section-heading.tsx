import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// Title on the left, optional link on the right, one rule of breathing room below. `level` only
// picks the tag; `size` picks the type step, so a visually large h3 stays legal in the outline.
export const sectionTitleVariants = cva('min-w-0', {
  variants: { size: { h1: 'text-h1', h2: 'text-h2', h3: 'text-h3' } },
  defaultVariants: { size: 'h2' },
});
type Props = React.ComponentProps<'div'> & VariantProps<typeof sectionTitleVariants> & {
  level?: 2 | 3; titleId?: string; action?: React.ReactNode;
};
export function SectionHeading({ className, size, level = 2, titleId, action, children, ...props }: Props) {
  const Title = level === 2 ? 'h2' : 'h3';
  return <div data-slot="section-heading" className={cn('mb-5 flex flex-wrap items-center justify-between gap-4', className)} {...props}>
    <Title id={titleId} className={cn(sectionTitleVariants({ size }))}>{children}</Title>
    {action}
  </div>;
}
