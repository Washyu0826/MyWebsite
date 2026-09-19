import { cn } from '@/lib/utils';
// Every top-level page opens the same way: one h1, one grey standfirst capped at a readable measure.
export function PageHeading({ className, title, description, children, ...props }:
  Omit<React.ComponentProps<'header'>, 'title'> & { title: React.ReactNode; description?: React.ReactNode }) {
  return <header className={cn('mb-12', className)} {...props}>
    <h1 className="text-h1">{title}</h1>
    {description ? <p className="mt-5 max-w-[60ch] text-graphite">{description}</p> : null}
    {children}
  </header>;
}
