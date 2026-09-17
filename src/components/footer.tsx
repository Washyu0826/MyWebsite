import { getTranslations } from 'next-intl/server';
import { getProfile } from '@/lib/db/profile';
import { emailUrl, safeUrl } from '@/lib/urls';
import { Container } from './container';
export async function Footer() {
  const t = await getTranslations('Site');
  const profile = await getProfile();
  const email = emailUrl(profile.email);
  return <footer className="site-footer"><Container className="footer-inner">
    <div className="flex flex-wrap items-center gap-5">
      {profile.social_links.filter(s => safeUrl(s.url)).map(s => <a className="text-link" key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">{s.label || s.platform}</a>)}
      {email && <a className="text-link" href={email}>{t('email')}</a>}
    </div>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2"><span>{t('footerNote')}</span><span>{t('copyright', { year: new Date().getFullYear() })}</span></div>
  </Container></footer>;
}
