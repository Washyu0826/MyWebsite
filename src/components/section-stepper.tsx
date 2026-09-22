'use client';
import { useEffect } from 'react';

/** Fallback lock, used only where `scrollend` is missing; the listener releases it sooner. */
const COOLDOWN = 700;
/** Kept after the glide lands, to swallow a trackpad's inertia tail without feeling frozen. */
const SETTLE = 140;
/** Smaller deltas are the tail of an earlier gesture, not a new intention. */
const THRESHOLD = 8;

/**
 * One section per wheel gesture on the homepage.
 *
 * Native `scroll-snap-type: mandatory` cannot do this: a short wheel tick lands nearer the stop it
 * left than the next one and is pulled straight back, so a reader has to push past the midpoint of
 * every section. This takes the wheel instead and moves to the next stop on its own, and then
 * ignores the wheel for a beat so a trackpad's coasting does not fire a second step.
 *
 * Kept out of the way where it would hurt: touch and keyboard are untouched, nothing happens under
 * 768px or without a fine pointer, and a section taller than the viewport scrolls through natively
 * until its far edge is on screen, so no row is ever unreachable. Reduced motion jumps instead of
 * gliding. Renders nothing.
 */
export function SectionStepper({ selector, offset }: { selector: string; offset: number }) {
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!media.matches) return;

    let busy = 0;
    // Releasing on scrollend rather than waiting out a fixed lock is what stops the page feeling
    // stuck: the wheel is free again the moment the glide finishes, not 400ms later.
    const release = () => { busy = Math.min(busy, performance.now() + SETTLE); };
    const hasScrollEnd = 'onscrollend' in window;
    if (hasScrollEnd) window.addEventListener('scrollend', release);
    const stops = () => {
      const sections = [...document.querySelectorAll<HTMLElement>(selector)];
      const doc = document.documentElement;
      const end = Math.max(0, doc.scrollHeight - window.innerHeight);
      const list = [0, ...sections.map(el => Math.min(end, Math.round(el.getBoundingClientRect().top + window.scrollY - offset))), end];
      return [...new Set(list)].sort((a, b) => a - b);
    };

    function onWheel(event: WheelEvent) {
      if (event.ctrlKey || Math.abs(event.deltaY) < THRESHOLD || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const now = performance.now();
      if (now < busy) { event.preventDefault(); return; }
      const down = event.deltaY > 0;
      const y = window.scrollY;
      const points = stops();
      // The stop the page is resting on, if any, and its section's extent.
      const index = points.findIndex(p => Math.abs(p - y) <= 2);
      if (index !== -1) {
        const next = points[index + (down ? 1 : -1)];
        if (next === undefined) return;
        // Inside a section taller than the viewport, let the wheel read it before stepping on.
        if (down && index > 0 && index < points.length - 1) {
          const section = document.querySelectorAll<HTMLElement>(selector)[index - 1];
          const bottom = section ? section.getBoundingClientRect().bottom + y : 0;
          if (bottom - y > window.innerHeight + 4) return;
        }
        event.preventDefault();
        busy = now + COOLDOWN;
        window.scrollTo({ top: next, behavior: reduce.matches ? 'auto' : 'smooth' });
        return;
      }
      // Between stops (after a keyboard scroll or a tall section): the next stop in the direction.
      const target = down ? points.find(p => p > y + 2) : [...points].reverse().find(p => p < y - 2);
      if (target === undefined) return;
      const current = down ? [...points].reverse().find(p => p < y) : points.find(p => p > y);
      if (down && current !== undefined) {
        const i = points.indexOf(current);
        const section = i > 0 ? document.querySelectorAll<HTMLElement>(selector)[i - 1] : null;
        const bottom = section ? section.getBoundingClientRect().bottom + y : 0;
        if (bottom - y > window.innerHeight + 4) return;
      }
      event.preventDefault();
      busy = now + COOLDOWN;
      window.scrollTo({ top: target, behavior: reduce.matches ? 'auto' : 'smooth' });
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      if (hasScrollEnd) window.removeEventListener('scrollend', release);
    };
  }, [selector, offset]);
  return null;
}
