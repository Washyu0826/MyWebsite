'use client';
import { useEffect, useRef } from 'react';
type Props = React.ComponentProps<'section'> & { as?: 'section' | 'div'; deferInitial?: boolean };
// Thresholds the entrance does not need; they are what lets the same observer keep reporting while a
// section travels through the viewport, so the section number can follow the reading position.
const STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.65, 0.8, 1];
// A section is the one being read when half of it is on screen, or when it covers half the screen —
// the second clause is for sections taller than the viewport, whose ratio never reaches a half.
export function sectionActive(ratio: number, visible: number, viewport: number) {
  return ratio >= 0.5 || (viewport > 0 && visible >= viewport * 0.5);
}
// Nothing is hidden until JS decides to hide it, and only while the block sits below the fold,
// so a failed bundle or a missing IntersectionObserver still leaves every section readable.
export function SectionReveal({ as: Tag = 'section', children, deferInitial = false, ...rest }: Props) {
  const scope = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = scope.current;
    if (!element) return;
    const show = () => { element.dataset.enter = 'in'; };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const below = element.getBoundingClientRect().top > window.innerHeight * 0.85;
    if (!('IntersectionObserver' in window)) { show(); return; }
    // The observer outlives the entrance: after it has shown the section it keeps the number in step.
    if (preference.matches || (!below && !deferInitial)) show(); else element.dataset.enter = 'out';
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) show();
        const viewport = entry.rootBounds?.height ?? window.innerHeight;
        const active = entry.isIntersecting && sectionActive(entry.intersectionRatio, entry.intersectionRect.height, viewport);
        element.dataset.active = active ? '1' : '';
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: STEPS });
    observer.observe(element);
    const finish = () => { if (preference.matches) show(); };
    preference.addEventListener('change', finish);
    return () => { preference.removeEventListener('change', finish); observer.disconnect(); show(); };
  }, [deferInitial]);
  // Both tags take an HTMLElement ref; the cast keeps one ref type for the union.
  const Element = Tag as 'section';
  return <Element ref={scope} data-enter="" {...rest}>{children}</Element>;
}
