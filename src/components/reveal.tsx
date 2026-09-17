'use client';
import { useEffect } from 'react';
import { useAnimate } from 'motion/react-mini';
const DURATION = 0.7, STEP = 0.08;
// CSS hides [data-reveal] until hydration (see layout.css); "done" always releases it.
export function Reveal({ children, order = 0 }: { children: React.ReactNode; order?: number }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  useEffect(() => {
    const element = scope.current;
    if (!element) return;
    const done = () => { element.dataset.reveal = 'done'; };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let seen = false;
    try { seen = Boolean(sessionStorage.getItem('hsien-intro')); } catch { /* Storage may be disabled. */ }
    if (seen || preference.matches) { done(); return; }
    const playback = animate(element, {
      clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'],
      transform: ['translateY(12px)', 'translateY(0px)'],
    }, { duration: DURATION, delay: order * STEP, ease: [0.16, 1, 0.3, 1] });
    playback.then(done);
    const finish = () => { if (preference.matches) playback.complete(); };
    preference.addEventListener('change', finish);
    // Safety net: never leave content clipped if the animation promise does not settle.
    const fallback = window.setTimeout(done, (DURATION + order * STEP) * 1000 + 200);
    // All reveal lines read before marking this session as seen.
    const seenTimer = window.setTimeout(() => {
      try { sessionStorage.setItem('hsien-intro', '1'); } catch { /* Storage may be disabled. */ }
    }, 100);
    return () => {
      window.clearTimeout(fallback); window.clearTimeout(seenTimer);
      preference.removeEventListener('change', finish); playback.stop(); done();
    };
  }, [animate, scope, order]);
  return <div ref={scope} data-reveal="">{children}</div>;
}
