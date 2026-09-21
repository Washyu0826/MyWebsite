import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import type { Locale } from '@/i18n/routing';
import type { Experience } from '@/types/content';
import { listExperiences } from '@/lib/db/profile';
import { pickLocale } from '@/lib/locale';
import { monthRangeLabel } from '@/lib/format';
import { FacetHeading } from './facet-heading';
import { SectionReveal } from './section-reveal';
import { Markdown } from './markdown';

type Labels = { present: string };

/** The organisation's mark, or its initial in the same square when there is no logo yet. */
function OrgMark({ logo, name }: { logo: string | null; name: string }) {
  if (logo) return <div className="experience-logo"><Image src={logo} alt="" width={56} height={56} sizes="56px" /></div>;
  const initial = [...name.trim()][0] ?? '';
  return <div className="experience-logo is-initial" aria-hidden="true"><span>{initial}</span></div>;
}

function ExperienceRows({ rows, locale, labels }: { rows: Experience[]; locale: Locale; labels: Labels }) {
  return rows.map((experience, index) => {
    const e = pickLocale(experience, locale);
    const period = monthRangeLabel(experience.start_date, experience.is_current ? null : experience.end_date, locale, labels.present);
    return <div key={experience.id} className="experience-row" style={{ '--enter-index': index } as React.CSSProperties}>
      <OrgMark logo={experience.logo_url} name={e.org} />
      <div className="experience-row-main">
        <div className="experience-row-heading">
          <h3 className="font-medium">{e.org}<span className="ml-4 text-graphite">{e.role}</span></h3>
          <p className="experience-period text-meta text-graphite">{period}</p>
        </div>
        <div className="experience-description mt-2 text-meta text-graphite"><Markdown>{e.description}</Markdown></div>
      </div>
    </div>;
  });
}

/**
 * Two lists from one table, split on `kind`: education first, then everything else under
 * Experience. An empty education list leaves no heading behind.
 */
export async function HomeSections({ locale }: { locale: Locale }) {
  const [experiences, t] = await Promise.all([listExperiences(), getTranslations('Home')]);
  const education = experiences.filter(row => row.kind === 'education');
  const work = experiences.filter(row => row.kind !== 'education');
  const labels = { present: t('present') };

  return <>
    {education.length > 0 && <SectionReveal className="section experience-section education-section" aria-labelledby="education-heading">
      <div className="section-heading"><FacetHeading id="education-heading" text={t('education')} /></div>
      <ExperienceRows rows={education} locale={locale} labels={labels} />
    </SectionReveal>}
    <SectionReveal className="section experience-section" aria-labelledby="experience-heading">
      <div className="section-heading"><FacetHeading id="experience-heading" text={t('experience')} /></div>
      {!work.length && <p className="enter-item text-graphite">{t('noExperience')}</p>}
      <ExperienceRows rows={work} locale={locale} labels={labels} />
    </SectionReveal>
  </>;
}
