'use client';
import { useEffect } from 'react';

// Registration waits for `load` so the worker never competes with the first paint for bandwidth.
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // The mode travels in the URL because a file in public/ cannot read NEXT_PUBLIC_* at build time;
    // a dev worker must never cache, or it serves yesterday's chunks back into a running HMR session.
    const url = `/sw.js?mode=${process.env.NODE_ENV === 'production' ? 'production' : 'development'}`;
    const register = () => { void navigator.serviceWorker.register(url, { scope: '/' }).catch(() => {}); };
    if (document.readyState === 'complete') { register(); return; }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
