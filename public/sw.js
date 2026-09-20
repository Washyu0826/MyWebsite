/* Portfolio service worker.

   The version arrives in the registration URL (see src/app/offline/pwa-register.tsx), which
   next.config.ts fills from the commit on Vercel or the build time locally. That means a deploy
   changes this script's URL, the browser fetches it again, and `activate` deletes every cache not
   on the current list. Nothing here has to be edited by hand before shipping. */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'v1';
const SHELL = `hsien-shell-${VERSION}`;
const PAGES = `hsien-pages-${VERSION}`;
const ASSETS = `hsien-assets-${VERSION}`;
const CURRENT = [SHELL, PAGES, ASSETS];

const OFFLINE = { zh: '/zh/offline', en: '/en/offline' };
const PRECACHE = [OFFLINE.zh, OFFLINE.en, '/icons/icon-192.png', '/icons/icon.svg', '/manifest.webmanifest'];
// A dev server rebuilds on every keystroke; caching its chunks serves stale code and breaks HMR.
// In development the worker still installs and still answers offline, but it never stores a response.
// The mode comes from the registration URL (see src/app/offline/pwa-register.tsx).
const PASSIVE = new URL(self.location.href).searchParams.get('mode') !== 'production';

function offlineFor(url) {
  return url.pathname.startsWith('/en') ? OFFLINE.en : OFFLINE.zh;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    const chunks = new Set();
    // Individually: one missing file must not stop the whole worker from installing.
    await Promise.all(PRECACHE.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (!response.ok) return;
        const body = await response.blob();
        // A redirected response cannot go into a Cache, so re-wrap the body under our own key.
        await cache.put(path, new Response(body, { status: 200, headers: response.headers }));
        if (!response.headers.get('content-type')?.includes('text/html')) return;
        // The offline page is useless without the chunks that hydrate it, and those are only
        // discoverable from its own markup.
        const html = await new Response(body).text();
        for (const [url] of html.matchAll(/\/_next\/static\/[^"'\\)\s]+/g)) chunks.add(url);
      } catch { /* offline at install time: the next activation will try again */ }
    }));
    if (!PASSIVE && chunks.size) {
      const assets = await caches.open(ASSETS);
      await Promise.all([...chunks].map(url => assets.add(url).catch(() => {})));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('hsien-') && !CURRENT.includes(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

// The admin area, the API and signed resume downloads must always hit the network, and React
// Server Component payloads must never be replayed from a cache keyed by URL alone.
function bypass(url, request) {
  if (url.origin !== self.location.origin) return true;
  const path = url.pathname;
  if (path.startsWith('/admin') || path.startsWith('/api/') || path.startsWith('/resume/')) return true;
  if (url.searchParams.has('_rsc')) return true;
  if (request.headers.get('rsc') === '1' || request.headers.has('next-router-prefetch') || request.headers.has('next-action')) return true;
  return false;
}

function isStatic(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
    || /\.(?:css|js|mjs|woff2?|png|jpe?g|gif|svg|webp|avif|ico)$/.test(url.pathname);
}

// Pages: network first, so a visitor never reads yesterday's article.
async function respondWithPage(request) {
  try {
    const response = await fetch(request);
    if (!PASSIVE && response.ok && !response.redirected) {
      const cache = await caches.open(PAGES);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const url = new URL(request.url);
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = offlineFor(url);
    // Redirect rather than answer with the offline document under the requested URL: the App Router
    // would try to reconcile the mismatched route and land on the error boundary instead.
    if (url.pathname === offline) return await caches.match(offline) || Response.error();
    return Response.redirect(offline, 302);
  }
}

// Fingerprinted assets: cache first, they never change behind their URL.
async function respondWithAsset(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (bypass(url, request)) return;
  if (request.mode === 'navigate') { event.respondWith(respondWithPage(request)); return; }
  if (PASSIVE) return;
  if (isStatic(url)) event.respondWith(respondWithAsset(request));
});
