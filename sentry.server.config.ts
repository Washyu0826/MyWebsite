import * as Sentry from '@sentry/nextjs';

/** Node runtime. Inert without a DSN: init is never reached, so nothing is instrumented. */
export function initSentryServer() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    // Contact submissions carry names, addresses and message bodies; none of that belongs in a
    // crash report, so request bodies are dropped before an event leaves the process.
    beforeSend(event) {
      if (event.request) delete event.request.data;
      return event;
    },
  });
}
