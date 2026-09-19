import type { Project } from '@/types/content';
import type { Locale } from '@/i18n/routing';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { pickLocale } from '@/lib/locale';
import { getTranslations } from 'next-intl/server';
import { CoverPreview } from './cover-preview';
export async function ProjectList({ projects, locale, headingLevel = 2 }: { projects: Project[]; locale: Locale; headingLevel?: 2 | 3 }) {
  const t = await getTranslations('Projects');
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return <CoverPreview className="project-list">{projects.map(project => {
    const p = pickLocale(project, locale);
    const signals = [
      { label: t('problem'), value: p.problem || p.summary },
      { label: 'System', value: p.solution || project.tech_stack.slice(0, 3).join(' + ') },
      { label: t('outcome'), value: p.outcome || project.tech_stack.join(' / ') },
    ].filter(signal => signal.value);
    return <Link href={`/projects/${project.slug}`} className="project-row" key={project.id}
      data-cover-src={project.cover_url || undefined} data-cover-alt={p.cover_alt || p.title}>
      <div className="project-row-content">
        {project.cover_url ? <div className="project-thumb">
          <Image src={project.cover_url} alt={p.cover_alt || p.title} width={320} height={180} sizes="(min-width: 768px) 220px, 100vw" />
        </div> : null}
        <div className="project-copy">
          <div className="project-row-head"><Heading>{p.title}</Heading><span className="shrink-0 text-meta text-graphite">{project.period_start?.slice(0, 4)}</span></div>
          <p className="project-row-summary">{p.summary}</p>
          <dl className="project-signal-grid">
            {signals.map(signal => <div key={signal.label}>
              <dt>{signal.label}</dt>
              <dd>{signal.value}</dd>
            </div>)}
          </dl>
          <div className="project-row-meta">
            {p.role && <span><span className="mr-2">{t('role')}</span>{p.role}</span>}
            <ul className="tech-list" aria-label={t('tech')}>{project.tech_stack.map(tech => <li key={tech}>{tech}</li>)}</ul>
          </div>
        </div>
      </div>
    </Link>;
  })}</CoverPreview>;
}
