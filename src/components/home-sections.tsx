import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { listExperiences } from '@/lib/db/profile';
import { dateLabel, pickLocale } from '@/lib/locale';
import { Markdown } from './markdown';

export async function HomeSections({ locale }: { locale: Locale }) {
  const [experiences, t] = await Promise.all([listExperiences(), getTranslations('Home')]);

  return <>
    <section className="section experience-section" aria-labelledby="experience-heading">
      <div className="section-heading"><h2 id="experience-heading">{t('experience')}</h2></div>
      {!experiences.length && <p className="text-graphite">{t('noExperience')}</p>}
      {experiences.map(experience => {
        const e = pickLocale(experience, locale);
        return <div key={experience.id} className="experience-row">
          <p className="text-meta text-graphite">{dateLabel(experience.start_date, locale)} - {experience.is_current ? t('present') : dateLabel(experience.end_date, locale)}</p>
          <div>
            <h3 className="font-medium">{e.org}<span className="ml-4 text-graphite">{e.role}</span></h3>
            <div className="mt-2 text-meta text-graphite"><Markdown>{e.description}</Markdown></div>
          </div>
        </div>;
      })}
    </section>
  </>;
}
