'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAnimate } from 'motion/react-mini';
// Module scope: the first template mount of the session is the initial load, never a navigation.
// Keyed by path so React's development double-mount does not read as a route change either.
let lastPath: string | null = null;
export default function Template({ children }: { children: React.ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const wipe = useRef<HTMLDivElement>(null);
  // Decided once per mount: React's development double-invoke must not re-read it as a first load.
  const sweeps = useRef<boolean>(undefined);
  const pathname = usePathname();
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    const playback = animate(scope.current, { opacity: [0.7, 1], transform: ['translateY(6px)', 'translateY(0px)'] }, { duration: 0.28, ease: 'easeOut' });
    const finish = () => { if (preference.matches) playback.complete(); };
    preference.addEventListener('change', finish);
    return () => { preference.removeEventListener('change', finish); playback.stop(); };
  }, [animate, scope]);
  useEffect(() => {
    if (sweeps.current === undefined) { sweeps.current = lastPath !== null && lastPath !== pathname; lastPath = pathname; }
    const facet = wipe.current;
    if (!sweeps.current || !facet || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    facet.dataset.active = '1';
    const done = window.setTimeout(() => { delete facet.dataset.active; }, 540);
    return () => { window.clearTimeout(done); delete facet.dataset.active; };
  }, [pathname]);
  // The wipe sits outside the animated scope: motion leaves a transform on it, which would
  // otherwise make the fixed overlay resolve against the content box instead of the viewport.
  return <>
    <div ref={wipe} className="page-wipe" aria-hidden="true"><div className="page-wipe-facet" /></div>
    <div ref={scope}>{children}</div>
  </>;
}
