import { getTranslations } from 'next-intl/server';
import { getProfile } from '@/lib/db/profile';
import { emailUrl, safeUrl } from '@/lib/urls';
import { Container } from './container';
export async function Footer() {
  const t = await getTranslations('Site');
  const profile = await getProfile();
  const email = emailUrl(profile.email);
  const linkedin = profile.social_links.find(link => link.platform.toLowerCase() === 'linkedin' && safeUrl(link.url));
  const github = profile.social_links.find(link => link.platform.toLowerCase() === 'github' && safeUrl(link.url));
  return <footer className="site-footer"><Container className="footer-inner">
    <div className="flex flex-wrap items-center gap-5">
      {email && <a className="text-link" href={email}>{t('email')}</a>}
      {linkedin && <a className="text-link" href={linkedin.url} target="_blank" rel="noopener noreferrer">{linkedin.label || 'LinkedIn'}</a>}
      {github && <a className="text-link" href={github.url} target="_blank" rel="noopener noreferrer">{github.label || 'GitHub'}</a>}
    </div>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2"><span>{t('footerNote')}</span><span>{t('copyright', { year: new Date().getFullYear() })}</span></div>
  </Container></footer>;
}
