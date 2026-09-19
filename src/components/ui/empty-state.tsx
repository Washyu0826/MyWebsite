import { cn } from '@/lib/utils';
// The "no results / clear the filter" block that the projects and articles indexes both open with
// when a tag matches nothing. Rule on top so it reads as the first row of the list it replaces.
export function EmptyState({ className, action, children, ...props }:
  React.ComponentProps<'div'> & { action?: React.ReactNode }) {
  return <div data-slot="empty-state" className={cn('border-t border-rule py-10', className)} {...props}>
    <p>{children}</p>
    {action ? <div className="mt-2">{action}</div> : null}
  </div>;
}
