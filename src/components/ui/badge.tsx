import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// Status pill: draft/published, demo mode, form outcome. Tone carries the meaning, so the label
// never has to rely on colour alone — callers still pass readable text.
export const badgeVariants = cva('inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-nano whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'border-rule text-graphite',
      accent: 'border-indigo/60 text-indigo',
      success: 'border-success/60 text-success',
      danger: 'border-danger/60 text-danger',
    },
  },
  defaultVariants: { tone: 'neutral' },
});
export function Badge({ className, tone, ...props }:
  React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}
