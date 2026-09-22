import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { listProjects } from '@/lib/db/projects';
import { pageMetadata } from '@/lib/metadata';
import { ProjectList } from '@/components/project-list';
import { Container } from '@/components/container';
type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ tag?: string | string[] }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Projects' });
  return pageMetadata(locale, '/projects', t('title'), t('description'));
}
export default async function Projects({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tag: rawTag } = await searchParams;
  const tag = typeof rawTag === 'string' ? rawTag : undefined;
  const [all, projects, t] = await Promise.all([listProjects(), listProjects({ tag }), getTranslations('Projects')]);
  const tags = Array.from(new Set(all.flatMap(p => p.tags)));
  return <Container className="page listing-page"><header className="page-heading"><h1>{t('title')}</h1><p>{t('description')}</p></header>
    <nav className="filter-list" aria-label={t('filter')}>
      <Link href="/projects" className="filter-link" aria-current={!tag ? 'true' : undefined}>{t('all')}<span>{all.length}</span></Link>
      {tags.map(category => <Link key={category} href={{ pathname: '/projects', query: { tag: category } }}
        className="filter-link" aria-current={tag === category ? 'true' : undefined}>
        {t.has(category) ? t(category) : category}<span>{all.filter(p => p.tags.includes(category)).length}</span>
      </Link>)}
    </nav>
    {projects.length ? <ProjectList projects={projects} locale={locale} /> : <div className="border-t border-rule py-10"><p>{t('empty')}</p><Link className="text-link" href="/projects">{t('clear')}</Link></div>}
  </Container>;
}
