import { getTranslations } from 'next-intl/server';
import { getProfile } from '@/lib/db/profile';
import { TRACK } from '@/lib/audio/track';
import { emailUrl, safeUrl } from '@/lib/urls';
import { Container } from './container';
import { AmbientAudio } from './ambient-audio';
export async function Footer() {
  const t = await getTranslations('Site');
  const profile = await getProfile();
  const email = emailUrl(profile.email);
  const linkedin = profile.social_links.find(link => link.platform.toLowerCase() === 'linkedin' && safeUrl(link.url));
  const github = profile.social_links.find(link => link.platform.toLowerCase() === 'github' && safeUrl(link.url));
  // CC0 asks for no attribution; the line is here because saying where the recording came from is
  // worth a line of footer. The two link labels come from the message, the addresses from lib/audio/track.
  const credit = t.rich('audioCredit', {
    // Not .text-link: that is a 44px hit area, and these two sit inside a 12px sentence, where
    // WCAG 2.2's target-size rule exempts links in a line of text.
    src: chunks => <a href={TRACK.sourceUrl} target="_blank" rel="noopener noreferrer">{chunks}</a>,
    lic: chunks => <a href={TRACK.licenceUrl} target="_blank" rel="noopener noreferrer">{chunks}</a>,
  });
  return <footer className="site-footer"><Container className="footer-inner">
    <div className="flex flex-wrap items-center gap-5">
      {email && <a className="text-link" href={email}>{t('email')}</a>}
      {linkedin && <a className="text-link" href={linkedin.url} target="_blank" rel="noopener noreferrer">{linkedin.label || 'LinkedIn'}</a>}
      {github && <a className="text-link" href={github.url} target="_blank" rel="noopener noreferrer">{github.label || 'GitHub'}</a>}
    </div>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2"><span>{t('footerNote')}</span><span>{t('copyright', { year: new Date().getFullYear() })}</span></div>
    <p className="audio-credit">{credit}</p>
  </Container><AmbientAudio /></footer>;
}
