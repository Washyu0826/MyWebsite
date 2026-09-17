import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  images: {
    remotePatterns: storage ? [{
      protocol: 'https', hostname: new URL(storage).hostname,
      pathname: '/storage/v1/object/public/**',
    }] : [],
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/admin/:path*', headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};
export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
