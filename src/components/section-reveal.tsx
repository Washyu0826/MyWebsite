'use client';
import { useEffect, useRef } from 'react';
type Props = React.ComponentProps<'section'> & { as?: 'section' | 'div'; deferInitial?: boolean; replay?: boolean };
// Nothing is hidden until JS decides to hide it, and only while the block sits below the fold,
// so a failed bundle or a missing IntersectionObserver still leaves every section readable.
// With `replay`, the block is marked out again once it has left the viewport, so its entrance
// plays each time the page stops on it — the homepage snaps one section at a time, and every stop
// should read as arriving on a page, not returning to one.
export function SectionReveal({ as: Tag = 'section', children, deferInitial = false, replay = false, ...rest }: Props) {
  const scope = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = scope.current;
    if (!element) return;
    // Guarded, because writing an attribute that already holds its value still invalidates style for
    // the section and everything under it, and the callback below can fire more than once.
    let state: 'in' | 'out' | '' = '';
    const set = (next: 'in' | 'out') => { if (state === next) return; state = next; element.dataset.enter = next; };
    const show = () => set('in');
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const below = element.getBoundingClientRect().top > window.innerHeight * 0.85;
    if (!('IntersectionObserver' in window)) { show(); return; }
    if (preference.matches || (!below && !deferInitial)) show(); else set('out');
    // One threshold and one job. This used to carry nine, so that it could keep reporting which
    // section was being read while it travelled through the viewport - which existed to tint the
    // numbered badge beside each heading. The badges are gone, so the extra callbacks were paying
    // for nothing.
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting);
      if (visible) { show(); if (!replay) observer.disconnect(); }
      else if (replay && !preference.matches) set('out');
    }, { rootMargin: '0px 0px -12% 0px' });
    observer.observe(element);
    const finish = () => { if (preference.matches) show(); };
    preference.addEventListener('change', finish);
    return () => { preference.removeEventListener('change', finish); observer.disconnect(); show(); };
  }, [deferInitial, replay]);
  // Both tags take an HTMLElement ref; the cast keeps one ref type for the union.
  const Element = Tag as 'section';
  return <Element ref={scope} data-enter="" {...rest}>{children}</Element>;
}
