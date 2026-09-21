'use client';
import { useEffect, useRef } from 'react';
type Props = React.ComponentProps<'section'> & { as?: 'section' | 'div'; deferInitial?: boolean };
// Nothing is hidden until JS decides to hide it, and only while the block sits below the fold,
// so a failed bundle or a missing IntersectionObserver still leaves every section readable.
export function SectionReveal({ as: Tag = 'section', children, deferInitial = false, ...rest }: Props) {
  const scope = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = scope.current;
    if (!element) return;
    // Guarded, because writing an attribute that already holds its value still invalidates style for
    // the section and everything under it, and the callback below can fire more than once.
    let shown = false;
    const show = () => { if (shown) return; shown = true; element.dataset.enter = 'in'; };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const below = element.getBoundingClientRect().top > window.innerHeight * 0.85;
    if (!('IntersectionObserver' in window)) { show(); return; }
    if (preference.matches || (!below && !deferInitial)) show(); else element.dataset.enter = 'out';
    // One threshold and one job. This used to carry nine, so that it could keep reporting which
    // section was being read while it travelled through the viewport - which existed to tint the
    // numbered badge beside each heading. The badges are gone, so the extra callbacks were paying
    // for nothing.
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { show(); observer.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px' });
    observer.observe(element);
    const finish = () => { if (preference.matches) show(); };
    preference.addEventListener('change', finish);
    return () => { preference.removeEventListener('change', finish); observer.disconnect(); show(); };
  }, [deferInitial]);
  // Both tags take an HTMLElement ref; the cast keeps one ref type for the union.
  const Element = Tag as 'section';
  return <Element ref={scope} data-enter="" {...rest}>{children}</Element>;
}
