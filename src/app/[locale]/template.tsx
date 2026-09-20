'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const WIPE_MS = 420;
// Module scope: the first template mount of the session is the initial load, never a navigation.
// Keyed by path so React's development double-mount does not read as a route change either.
let lastPath: string | null = null;
// Shared by the click handler and the route effect so a single navigation cannot start the sweep
// twice and restart it half way through.
let running = 0;

function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Starts the sweep unless one is already playing. Returns false when it declined. */
function startWipe(facet: HTMLElement | null) {
  if (!facet || reduced()) return false;
  const now = performance.now();
  if (now - running < WIPE_MS) return false;
  running = now;
  facet.dataset.active = '1';
  window.setTimeout(() => {
    if (performance.now() - running >= WIPE_MS - 20) delete facet.dataset.active;
  }, WIPE_MS + 40);
  return true;
}

/** The internal destination of a click, or null when it is not an in-app navigation. */
function navigationTarget(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.('a');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return null;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Route handlers and files leave the app; the browser does a real load and the overlay would stick.
  if (/^\/(api|resume|monitoring)(\/|$)/.test(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return null;
  return url.pathname === window.location.pathname ? null : url.pathname;
}

export default function Template({ children }: { children: React.ReactNode }) {
  const wipe = useRef<HTMLDivElement>(null);
  // Decided once per mount: React's development double-invoke must not re-read it as a first load.
  const sweeps = useRef<boolean>(undefined);
  const pathname = usePathname();

  // Sweep from the click, not from the route commit. Waiting for the effect meant it began ~440ms
  // in, by which time the new page had already swapped and the sweep read as an unrelated flash.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (navigationTarget(event)) startWipe(wipe.current);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  // Fallback for navigations with no click to hang off: back/forward, the command palette, redirects.
  useEffect(() => {
    if (sweeps.current === undefined) { sweeps.current = lastPath !== null && lastPath !== pathname; }
    lastPath = pathname;
    if (sweeps.current) startWipe(wipe.current);
  }, [pathname]);

  return <>
    <div ref={wipe} className="page-wipe" aria-hidden="true"><div className="page-wipe-facet" /></div>
    {children}
  </>;
}
