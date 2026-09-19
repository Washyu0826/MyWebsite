'use client';
import { useEffect } from 'react';

/**
 * The last line of defence: an error thrown by the root layout itself, before any locale or
 * translation is available. It replaces <html>, so the copy is deliberately bilingual and inline —
 * globals.css may be exactly what failed to load.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // Imported lazily and only with a DSN configured, so a demo build ships no Sentry to the browser.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import('@sentry/nextjs').then(Sentry => Sentry.captureException(error));
  }, [error]);
  return <html lang="zh-TW">
    <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem',
      background: '#0D0E10', color: '#F5F5F2', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, margin: '0 0 0.75rem' }}>暫時無法載入內容。</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#A7A9AD', lineHeight: 1.7 }}>
          請重新整理頁面，或稍後再試。
          <br />
          Something went wrong loading this page. Please reload, or try again shortly.
        </p>
        <a href="/" style={{ display: 'inline-block', minHeight: '44px', lineHeight: '44px', padding: '0 1.25rem',
          border: '1px solid #2B2D31', borderRadius: '2px', color: '#F5F5F2', textDecoration: 'none' }}>
          回到首頁 / Back to the home page
        </a>
        {error.digest ? <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#62656B' }}>Reference: {error.digest}</p> : null}
      </main>
    </body>
  </html>;
}
