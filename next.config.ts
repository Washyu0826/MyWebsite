import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;
function storageHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL must be an absolute URL such as https://<ref>.supabase.co (received "${value}").`);
  }
}
// The service worker's cache names are keyed on this, and its registration URL carries it, so a new
// deploy is a new worker and `activate` drops the previous caches. On Vercel it is the commit; a
// local production build gets the build time. Forgetting to bump a version by hand is how visitors
// end up stuck on last week's bundle with no way to clear it themselves.
const swVersion = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8) || `local-${Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_SW_VERSION: swVersion },
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  images: {
    remotePatterns: storage
      ? [
          {
            protocol: 'https',
            hostname: storageHostname(storage),
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/admin/:path*', headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);

// Error monitoring is opt-in. With no DSN the wrapper is skipped entirely, so the demo build and
// local development produce exactly the same output they did before Sentry was added: no tunnel
// route, no instrumentation, no upload step. See docs/testing.md for the environment variables.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(withNextIntl, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Uploading needs a token; without one the build still succeeds, just without readable stacks.
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
      // Ad blockers drop requests to the Sentry ingest domain. Routing them through this origin first
      // is the difference between seeing production errors and quietly seeing none.
      tunnelRoute: '/monitoring',
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: false,
      silent: !process.env.CI,
    })
  : withNextIntl;
