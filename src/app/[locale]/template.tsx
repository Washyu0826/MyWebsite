'use client';
import { useEffect } from 'react';
import { useAnimate } from 'motion/react-mini';
export default function Template({ children }: { children: React.ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    const playback = animate(scope.current, { opacity: [0.7, 1], transform: ['translateY(6px)', 'translateY(0px)'] }, { duration: 0.28, ease: 'easeOut' });
    const finish = () => { if (preference.matches) playback.complete(); };
    preference.addEventListener('change', finish);
    return () => { preference.removeEventListener('change', finish); playback.stop(); };
  }, [animate, scope]);
  return <div ref={scope}>{children}</div>;
}
