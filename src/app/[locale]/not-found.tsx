import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/container';
import { CubistFigure } from '@/components/cubist-figure';
export default async function NotFound() {
  const t = await getTranslations('Site');
  return <Container className="page page-figure"><div>
    <p className="mb-4 font-mono text-meta text-graphite">404</p>
    <h1 className="text-h1">{t('notFoundTitle')}</h1><p className="mt-6 max-w-[60ch] text-graphite">{t('notFoundBody')}</p>
    <Link className="text-link mt-6" href="/projects">{t('projects')}</Link>
  </div><CubistFigure /></Container>;
}
