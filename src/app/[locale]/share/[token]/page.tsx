import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Clock, Download, File as FileIcon, Link2Off } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatAssetBytes, type ShareState } from '@/lib/assets/model';
import { peekShare } from '@/lib/assets/shares';
import { Container } from '@/components/container';

// A share link is one-off and time-limited; nothing here may be cached or indexed.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale; token: string }>; searchParams: Promise<{ error?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Share' });
  return { title: t('title'), description: t('description'), robots: { index: false, follow: false } };
}

function when(value: string | undefined, locale: Locale) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(new Date(value));
}

export default async function SharePage({ params, searchParams }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const [t, share, query] = await Promise.all([getTranslations('Share'), peekShare(token), searchParams]);
  const unavailable: Record<Exclude<ShareState, 'active'>, string> = {
    expired: t('expired'),
    revoked: t('revoked'),
    exhausted: t('exhausted'),
    missing: t('missing'),
  };

  if (share.state !== 'active') {
    return <Container className="page share-page">
      <div className="share-card">
        <Link2Off size={28} aria-hidden="true" />
        <h1>{unavailable[share.state]}</h1>
        <p className="text-graphite">{t('unavailableHint')}</p>
        <Link className="text-link" href="/contact">{t('contact')}</Link>
      </div>
    </Container>;
  }

  return <Container className="page share-page">
    <div className="share-card">
      <FileIcon size={28} aria-hidden="true" />
      <p className="text-meta text-graphite">{t('heading')}</p>
      <h1>{share.label || share.name}</h1>
      <dl className="share-meta">
        <div><dt>{share.mime_type}</dt><dd>{share.size_bytes ? formatAssetBytes(share.size_bytes) : ''}</dd></div>
        <div><dt><Clock size={14} aria-hidden="true" /> {t('expires', { date: when(share.expires_at, locale) })}</dt>
          <dd>{share.max_opens
            ? t('opensCapped', { opens: share.opens ?? 0, max: share.max_opens })
            : t('opens', { opens: share.opens ?? 0 })}</dd></div>
      </dl>
      {query.error ? <p className="admin-error" role="alert">{t('failed')}</p> : null}
      {/* A POST keeps mail scanners and link previewers from spending one of the opens. */}
      <form method="post" action={`/${locale}/share/${encodeURIComponent(token)}/download`}>
        <button type="submit" className="share-download"><Download size={18} aria-hidden="true" /> {t('download')}</button>
      </form>
      <p className="text-meta text-graphite">{t('downloadHint')}</p>
    </div>
  </Container>;
}
