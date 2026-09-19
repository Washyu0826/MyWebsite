import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { listExperiences } from '@/lib/db/profile';
import { pickLocale } from '@/lib/locale';
import { monthRangeLabel } from '@/lib/format';
import { SectionReveal } from './section-reveal';
import { Markdown } from './markdown';

export async function HomeSections({ locale }: { locale: Locale }) {
  const [experiences, t] = await Promise.all([listExperiences(), getTranslations('Home')]);

  return <SectionReveal className="section experience-section" aria-labelledby="experience-heading">
    <div className="section-heading"><h2 id="experience-heading" className="enter-item">{t('experience')}</h2></div>
    {!experiences.length && <p className="enter-item text-graphite">{t('noExperience')}</p>}
    {experiences.map((experience, index) => {
      const e = pickLocale(experience, locale);
      return <div key={experience.id} className="experience-row" style={{ '--enter-index': index } as React.CSSProperties}>
        <p className="text-meta text-graphite">{monthRangeLabel(experience.start_date, experience.is_current ? null : experience.end_date, locale, t('present'))}</p>
        <div>
          <h3 className="font-medium">{e.org}<span className="ml-4 text-graphite">{e.role}</span></h3>
          <div className="mt-2 text-meta text-graphite"><Markdown>{e.description}</Markdown></div>
        </div>
      </div>;
    })}
  </SectionReveal>;
}
