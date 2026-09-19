import * as Sentry from '@sentry/nextjs';

/**
 * Browser-side error monitoring. Called from instrumentation-client.ts rather than executed on
 * import, because Turbopack (which `npm run dev` uses) no longer picks this filename up on its own.
 *
 * With no NEXT_PUBLIC_SENTRY_DSN this never calls init, so nothing is loaded, nothing is sent and
 * local development and the demo build behave exactly as they did before Sentry existed.
 */
export function initSentryClient() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    // Ad blockers recognise the Sentry ingest domain; the tunnel route in next.config.ts keeps
    // reports on this origin so they are not silently dropped.
    tunnel: '/monitoring',
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // A personal site does not need session replay, and it is the largest thing Sentry ships.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    // Browser extensions and cancelled navigations are noise, not defects.
    ignoreErrors: ['ResizeObserver loop', 'AbortError', 'Non-Error promise rejection captured'],
  });
}
