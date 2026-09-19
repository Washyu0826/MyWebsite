'use client';
import { useEffect, useRef, useState } from 'react';

// Decorative scroll indicator for long reads. Fixed so it never shifts the layout, aria-hidden so
// screen readers skip it, and absent entirely when the visitor asked for reduced motion.
export function ReadingProgress({ target }: { target: string }) {
  const [enabled, setEnabled] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setEnabled(!motion.matches);
    sync();
    motion.addEventListener('change', sync);
    return () => motion.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const element = document.querySelector<HTMLElement>(target);
    if (!element) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = element.getBoundingClientRect();
      // Progress through the article body itself: 0 when its top meets the viewport bottom,
      // 1 once its last line has scrolled into view.
      const total = box.height;
      const ratio = total > 0 ? (window.innerHeight - box.top) / total : 1;
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
    };
    const schedule = () => { frame ||= window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, target]);

  if (!enabled) return null;
  return <div aria-hidden="true" data-print="hide" data-reading-progress=""
    style={{ position: 'fixed', insetInline: 0, top: 0, height: 2, zIndex: 30, pointerEvents: 'none' }}>
    <div ref={bar} style={{ height: '100%', background: 'var(--indigo)', transformOrigin: '0 50%', transform: 'scaleX(0)' }} />
  </div>;
}
