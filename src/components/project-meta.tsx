import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { Project } from '@/types/content';
import { dateLabel, pickLocale } from '@/lib/locale';
import { safeUrl } from '@/lib/urls';
export async function ProjectMeta({ project, locale }: { project: Project; locale: Locale }) {
  const t = await getTranslations('Projects');
  const p = pickLocale(project, locale);
  const links = [{ label: 'demo', url: project.demo_url }, { label: 'repository', url: project.repo_url }, { label: 'video', url: project.video_url }];
  return <dl className="case-meta">
    {project.period_start && <div><dt>{t('period')}</dt><dd>{dateLabel(project.period_start, locale)}{project.period_end && <> – {dateLabel(project.period_end, locale)}</>}</dd></div>}
    {p.role && <div><dt>{t('role')}</dt><dd>{p.role}</dd></div>}
    {project.team_size !== null && project.team_size > 0 && <div><dt>{t('team')}</dt><dd>{t('people', { count: project.team_size })}</dd></div>}
    <div><dt>{t('tech')}</dt><dd><ul className="flex flex-wrap gap-x-3 gap-y-1 md:flex-col">{project.tech_stack.map(tech => <li key={tech}>{tech}</li>)}</ul></dd></div>
    {links.some(l => safeUrl(l.url)) && <div><dt>{t('links')}</dt><dd>{links.filter(l => safeUrl(l.url)).map(l =>
      <a className="text-link mr-4" href={l.url!} key={l.label} target="_blank" rel="noopener noreferrer">{t(l.label)}</a>)}</dd></div>}
  </dl>;
}
