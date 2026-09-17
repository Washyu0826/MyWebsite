'use client';
import { useEffect } from 'react';
import { useAnimate } from 'motion/react-mini';
export function Reveal({ children, order = 0 }: { children: React.ReactNode; order?: number }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    try {
      if (sessionStorage.getItem('hsien-intro')) return;
      const playback = preference.matches ? null : animate(scope.current, {
        clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'],
        transform: ['translateY(12px)', 'translateY(0px)'],
      }, { duration: 0.7, delay: order * 0.08, ease: [0.16, 1, 0.3, 1] });
      const finish = () => { if (preference.matches) playback?.complete(); };
      preference.addEventListener('change', finish);
      // All reveal lines read before marking this session as seen.
      const id = window.setTimeout(() => {
        try { sessionStorage.setItem('hsien-intro', '1'); } catch { /* Storage may be disabled. */ }
      }, 100);
      return () => { window.clearTimeout(id); preference.removeEventListener('change', finish); playback?.stop(); };
    } catch { /* Content remains visible when browser storage is unavailable. */ }
  }, [animate, scope, order]);
  return <div ref={scope}>{children}</div>;
}
