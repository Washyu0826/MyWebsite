'use client';
import { ThemeProvider } from 'next-themes';
import { useEffect, useRef } from 'react';
import { daylightValue, hourOf } from '@/lib/daylight';
// Ten seconds of nothing at all before the edges draw down.
const IDLE_MS = 10_000;
// Long visits should still track the clock, but the tint moves far too slowly to poll faster.
const CLOCK_MS = 10 * 60 * 1000;
const WAKE = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;
/** Wrapper that carries the visitor-driven state: idle, scrolled past the first screen, time of day.
    It writes to the DOM through refs rather than through state, so none of this re-renders the page. */
function SiteChrome({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--daylight', daylightValue(hourOf(new Date())));
    apply();
    const clock = window.setInterval(apply, CLOCK_MS);
    return () => {
      window.clearInterval(clock);
      root.style.removeProperty('--daylight');
    };
  }, []);
  useEffect(() => {
    const node = wrap.current, mark = sentinel.current;
    if (!node || !mark) return;
    // A one-screen sentinel pinned to the top of the document: the header state is a callback, never
    // a measurement taken inside a scroll handler.
    const watcher = new IntersectionObserver(([entry]) => { node.dataset.scrolled = entry.isIntersecting ? '0' : '1'; });
    watcher.observe(mark);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer = 0;
    const wake = () => {
      node.dataset.idle = '0';
      window.clearTimeout(timer);
      if (!reduce.matches) timer = window.setTimeout(() => { node.dataset.idle = '1'; }, IDLE_MS);
    };
    for (const event of WAKE) window.addEventListener(event, wake, { passive: true });
    reduce.addEventListener('change', wake);
    wake();
    return () => {
      window.clearTimeout(timer);
      watcher.disconnect();
      for (const event of WAKE) window.removeEventListener(event, wake);
      reduce.removeEventListener('change', wake);
    };
  }, []);
  // Both attributes render with their resting value, so the server HTML and the first client paint agree.
  return <div ref={wrap} className="site-chrome" data-idle="0" data-scrolled="0">
    <div ref={sentinel} className="chrome-sentinel" aria-hidden="true" />
    {children}
    <div className="chrome-vignette" aria-hidden="true" />
  </div>;
}
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
    <SiteChrome>{children}</SiteChrome>
  </ThemeProvider>;
}
