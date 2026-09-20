'use client';
import { useEffect, type RefObject } from 'react';
// Light moving over the h1: each character's brightness is a function of its distance from the pointer,
// measured in character widths so the lit patch stays two or three letters wide at any font size.
const SPAN = 1.7, LINE_WEIGHT = 1.8;
// Smoothstep, so the patch has no edge: 1 under the pointer, 0 once SPAN characters away.
export function glowAt(distance: number, span = SPAN) {
  const t = 1 - Math.min(Math.abs(distance) / span, 1);
  return t * t * (3 - 2 * t);
}
// No fine pointer: the same patch, placed by how far the page has scrolled instead of by a cursor.
export function scrollFocus(scrolled: number, span: number, count: number) {
  if (count < 2) return 0;
  const progress = span > 0 ? Math.min(Math.max(scrolled / span, 0), 1) : 0;
  return progress * (count - 1);
}
// Listeners live on the heading itself (plus a boolean-only window scroll handler), so no page carries
// a pointer handler for this; everything is rAF-throttled, passive, and detached on unmount.
export function useHeadingGlow(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = scope.current;
    if (!host || !window.matchMedia) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    let letters: HTMLElement[] = [], boxes: { x: number; y: number }[] = [];
    let unit = 0, stale = true, frame = 0, point: { x: number; y: number } | null = null;
    const read = () => {
      letters = Array.from(host.querySelectorAll<HTMLElement>('.letter'));
      let total = 0;
      boxes = letters.map(letter => {
        const box = letter.getBoundingClientRect();
        total += box.width;
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      });
      unit = letters.length ? total / letters.length : 0;
      stale = false;
    };
    const paint = (at: (index: number) => number) => {
      letters.forEach((letter, index) => {
        const value = at(index);
        letter.style.setProperty('--glow', value > 0.004 ? value.toFixed(3) : '0');
      });
    };
    const draw = () => {
      frame = 0;
      if (stale) read();
      if (!letters.length) return;
      if (!fine.matches) {
        const focus = scrollFocus(window.scrollY, window.innerHeight * 0.85, letters.length);
        paint(index => glowAt(index - focus));
        return;
      }
      const spot = point;
      if (!spot || !unit) { paint(() => 0); return; }
      paint(index => glowAt(Math.hypot(boxes[index].x - spot.x, (boxes[index].y - spot.y) * LINE_WEIGHT) / unit));
    };
    const tick = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const move = (event: PointerEvent) => { point = { x: event.clientX, y: event.clientY }; tick(); };
    // Scrolling and resizing only invalidate the measurements; they are listened to while the pointer
    // is on the heading, or for the whole time in the scroll-driven fallback.
    const shift = () => { stale = true; tick(); };
    let following = false;
    // pointerover rather than pointerenter: it also catches a pointer that was already on the heading.
    const enter = () => {
      if (following) return;
      following = true;
      host.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('scroll', shift, { passive: true });
      window.addEventListener('resize', shift, { passive: true });
    };
    const stop = () => {
      if (!following) return;
      following = false;
      host.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', shift);
      window.removeEventListener('resize', shift);
    };
    // The patch fades out where it was left, then nothing is listening until the pointer returns.
    const leave = () => { stop(); point = null; tick(); };
    let detach = () => {};
    const attach = () => {
      detach();
      // A letter with no --glow of its own falls back to the registered 0, which is the plain heading.
      if (still.matches) { letters.forEach(letter => letter.style.removeProperty('--glow')); return; }
      stale = true;
      if (fine.matches) {
        host.addEventListener('pointerover', enter, { passive: true });
        host.addEventListener('pointerleave', leave, { passive: true });
        detach = () => {
          stop();
          host.removeEventListener('pointerover', enter);
          host.removeEventListener('pointerleave', leave);
          detach = () => {};
        };
        return;
      }
      window.addEventListener('scroll', shift, { passive: true });
      window.addEventListener('resize', shift, { passive: true });
      detach = () => {
        window.removeEventListener('scroll', shift);
        window.removeEventListener('resize', shift);
        detach = () => {};
      };
      tick();
    };
    attach();
    still.addEventListener('change', attach);
    fine.addEventListener('change', attach);
    return () => {
      detach();
      still.removeEventListener('change', attach);
      fine.removeEventListener('change', attach);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scope]);
}
