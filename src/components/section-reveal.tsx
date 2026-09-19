'use client';
import { useEffect, useRef } from 'react';
type Props = React.ComponentProps<'section'> & { as?: 'section' | 'div' };
// Nothing is hidden until JS decides to hide it, and only while the block sits below the fold,
// so a failed bundle or a missing IntersectionObserver still leaves every section readable.
export function SectionReveal({ as: Tag = 'section', children, ...rest }: Props) {
  const scope = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = scope.current;
    if (!element) return;
    const show = () => { element.dataset.enter = 'in'; };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const below = element.getBoundingClientRect().top > window.innerHeight * 0.85;
    if (preference.matches || !below || !('IntersectionObserver' in window)) { show(); return; }
    element.dataset.enter = 'out';
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { show(); observer.disconnect(); }
    }, { rootMargin: '0px 0px -12% 0px' });
    observer.observe(element);
    const finish = () => { if (preference.matches) { show(); observer.disconnect(); } };
    preference.addEventListener('change', finish);
    return () => { preference.removeEventListener('change', finish); observer.disconnect(); show(); };
  }, []);
  // Both tags take an HTMLElement ref; the cast keeps one ref type for the union.
  const Element = Tag as 'section';
  return <Element ref={scope} data-enter="" {...rest}>{children}</Element>;
}
