// Next.js loads this file in every server runtime. Sentry is pulled in dynamically and only when a
// DSN is configured, so a demo build never bundles or evaluates it at all.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSentryServer } = await import('./sentry.server.config');
    initSentryServer();
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    const { initSentryEdge } = await import('./sentry.edge.config');
    initSentryEdge();
  }
}

/** Reports errors thrown inside a Server Component, a route handler or a server action. */
export async function onRequestError(...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) {
  if (!dsn) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
}
