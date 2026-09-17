import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;
function storageHostname(value: string) {
  try { return new URL(value).hostname; }
  catch { throw new Error(`NEXT_PUBLIC_SUPABASE_URL must be an absolute URL such as https://<ref>.supabase.co (received "${value}").`); }
}
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  images: {
    remotePatterns: storage ? [{
      protocol: 'https', hostname: storageHostname(storage),
      pathname: '/storage/v1/object/public/**',
    }] : [],
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
export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
