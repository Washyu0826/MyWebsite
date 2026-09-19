// Next.js loads this on the client for every route, under both webpack and Turbopack. The DSN is
// inlined at build time, so with none configured the bundler drops the Sentry chunk entirely and
// the browser never downloads or runs a byte of it.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) void import('./sentry.client.config').then(({ initSentryClient }) => initSentryClient());

/** Ties a client-side navigation to the span it belongs to. */
export function onRouterTransitionStart(href: string, navigationType: 'push' | 'replace' | 'traverse') {
  if (!dsn) return;
  void import('@sentry/nextjs').then(Sentry => Sentry.captureRouterTransitionStart(href, navigationType));
}
