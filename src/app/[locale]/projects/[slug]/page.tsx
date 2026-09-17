import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getProjectBySlug, listProjects } from '@/lib/db/projects';
import { pickLocale } from '@/lib/locale';
import { pageMetadata } from '@/lib/metadata';
import { Container } from '@/components/container';
import { Markdown } from '@/components/markdown';
import { ProjectMeta } from '@/components/project-meta';
import { ImageLightbox } from '@/components/image-lightbox';
type Props = { params: Promise<{ locale: Locale; slug: string }> };
export async function generateStaticParams() { return (await listProjects()).map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  const p = pickLocale(project, locale);
  return pageMetadata(locale, `/projects/${slug}`, p.title, p.summary);
}
export default async function ProjectDetail({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [project, t] = await Promise.all([getProjectBySlug(slug), getTranslations('Projects')]);
  if (!project) notFound();
  const p = pickLocale(project, locale);
  return <Container className="page">
    <Link href="/projects" className="text-link mb-8 text-meta">{t('back')}</Link>
    <header className="page-heading"><h1>{p.title}</h1><p>{p.summary}</p></header>
    {project.cover_url && <Image src={project.cover_url} alt={p.cover_alt || p.title} width={1200} height={675}
      priority sizes="(max-width: 767px) calc(100vw - 40px), 984px" className="h-auto w-full rounded-lg border border-rule bg-ash" />}
    <div className="case-grid"><ProjectMeta project={project} locale={locale} /><div className="case-body">
      {(['problem', 'solution'] as const).map(section => p[section] && <section className="case-section" key={section}>
        <h2>{t(section)}</h2><Markdown>{p[section]}</Markdown></section>)}
      {project.architecture_url && <section className="case-section"><h2>{t('architecture')}</h2>
        <ImageLightbox src={project.architecture_url} alt={p.architecture_alt || t('architecture')} /></section>}
      {p.body && <section className="case-section"><h2>{t('body')}</h2><Markdown>{p.body}</Markdown></section>}
      {!!project.media.length && <section className="case-section"><h2>{t('screenshots')}</h2><div className="grid gap-6">
        {project.media.filter(m => m.media_type === 'image').map(media => {
          const m = pickLocale(media, locale);
          return <figure key={media.id}><ImageLightbox src={media.url} alt={m.alt || t('image')}
            width={media.width || 1200} height={media.height || 675} />
            {m.caption && <figcaption className="mt-3 text-meta text-graphite">{m.caption}</figcaption>}</figure>;
        })}</div></section>}
      {(p.outcome || project.metrics.length > 0) && <section className="case-section"><h2>{t('outcome')}</h2>
        {project.metrics.length > 0 && <dl className="mb-6 flex flex-wrap gap-8">{project.metrics.map(metric => <div key={metric.id} className="flex flex-col">
          <dt className="order-2 text-meta text-graphite">{pickLocale(metric, locale).label}</dt><dd className="order-1 font-mono text-h2">{metric.value}</dd>
        </div>)}</dl>}<Markdown>{p.outcome}</Markdown></section>}
      {p.contribution && <section className="case-section"><h2>{t('contribution')}</h2><Markdown>{p.contribution}</Markdown></section>}
    </div></div>
    <nav className="project-pager" aria-label={t('title')}>
      {project.previous ? <Link href={`/projects/${project.previous.slug}`}><span className="block text-meta text-graphite">{t('previous')}</span>{pickLocale(project.previous, locale).title}</Link> : <span />}
      {project.next && <Link href={`/projects/${project.next.slug}`}><span className="block text-meta text-graphite">{t('next')}</span>{pickLocale(project.next, locale).title}</Link>}
    </nav>
  </Container>;
}
