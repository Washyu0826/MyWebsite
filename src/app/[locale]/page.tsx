import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Github, Linkedin, Mail } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/db/profile';
import { listProjects } from '@/lib/db/projects';
import { pickLocale } from '@/lib/locale';
import { emailUrl, gmailComposeUrl, safeUrl } from '@/lib/urls';
import { pageMetadata } from '@/lib/metadata';
import { Container } from '@/components/container';
import { Reveal } from '@/components/reveal';
import { Markdown } from '@/components/markdown';
import { ProjectList } from '@/components/project-list';
import { HomeSections } from '@/components/home-sections';
import { CubistBackdrop } from '@/components/cubist-backdrop';
import { ResumeLink } from '@/components/resume-link';
import { buttonVariants } from '@/components/ui/button';
type Props = { params: Promise<{ locale: Locale }> };
const focusAreas = ['Software Engineer', 'Data', 'AI', 'Full Stack', 'Cloud'];
const heroTagline = 'Curiosity driven, clarity obsessed.';
const designPrinciples = [
  {
    code: '01',
    title: 'Why before How',
    body: 'Intent matters most. I need to understand the fundamental reason behind a problem before jumping into execution.',
  },
  {
    code: '02',
    title: 'Radically Candid',
    body: 'Honest feedback over polite silence. I value direct communication that helps everyone grow and keeps things moving.',
  },
  {
    code: '03',
    title: 'Embrace the Iteration',
    body: 'Nothing is perfect on the first try. I prefer acting fast, gathering feedback, and constantly refining the approach.',
  },
];

function HeroSocialLinks({ profile, label }: { profile: Awaited<ReturnType<typeof getProfile>>; label: string }) {
  const links = profile.social_links.filter(s => safeUrl(s.url));
  const emailSocial = links.find(s => ['email', 'gmail'].includes(s.platform.toLowerCase()));
  const email = gmailComposeUrl(profile.email) || emailSocial?.url;
  const github = links.find(s => s.platform.toLowerCase() === 'github');
  const linkedin = links.find(s => s.platform.toLowerCase() === 'linkedin');
  const items = [
    email ? { label: 'Gmail', href: email, Icon: Mail } : null,
    linkedin ? { label: linkedin.label || 'LinkedIn', href: linkedin.url, Icon: Linkedin } : null,
    github ? { label: github.label || 'GitHub', href: github.url, Icon: Github } : null,
  ].filter(Boolean) as { label: string; href: string; Icon: typeof Mail }[];

  if (!items.length) return null;

  return <nav className="hero-socials" aria-label={label}>
    {items.map(({ label, href, Icon }) => <a key={label} href={href} aria-label={label} title={label} target={href.startsWith('mailto:') ? undefined : '_blank'} rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}>
      <Icon size={18} aria-hidden="true" />
    </a>)}
  </nav>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home' });
  const p = pickLocale(await getProfile(), locale);
  return pageMetadata(locale, '', t('title'), p.seo_description || t('description'));
}
export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [profile, projects, t, site] = await Promise.all([getProfile(), listProjects(), getTranslations('Home'), getTranslations('Site')]);
  const p = pickLocale(profile, locale);
  const email = emailUrl(profile.email);
  const nowParts = p.now.split(' · ');
  return <div className="home-stage"><CubistBackdrop /><Container className="home-container">
    <section className="hero" aria-labelledby="intro-heading">
      <div className="hero-grid hero-grid-text-only">
        <div>
          <Reveal><p className="mb-5 text-meta text-graphite">{p.name}</p></Reveal>
          <Reveal order={1}><h1 id="intro-heading">{p.headline}</h1></Reveal>
          <Reveal order={2}><div className="positioning"><Markdown>{heroTagline}</Markdown></div></Reveal>
          <div className="status-line"><span>{t('now')}</span><span>{nowParts.length > 1 ? <>
            {nowParts[0]} <span aria-hidden="true">·</span> <strong>{nowParts.slice(1).join(' · ')}</strong>
          </> : p.now}</span></div>
          <HeroSocialLinks profile={profile} label={site('socialLinks')} />
          <ul className="hero-focus-list" aria-label={t('hashtags')}>
            {focusAreas.map(area => <li key={area}>{area}</li>)}
          </ul>
          <div className="signature-principles" aria-label="Design principles">
            {designPrinciples.map(principle => <div key={principle.code} className="signature-principle">
              <span>{principle.code}</span>
              <strong>{principle.title}</strong>
              <p>{principle.body}</p>
            </div>)}
          </div>
          <div className="mt-6 md:hidden"><ResumeLink profile={profile} locale={locale} /></div>
        </div>
      </div>
    </section>
    <HomeSections locale={locale} />
    <section className="section project-section" aria-labelledby="projects-heading">
      <div className="section-heading"><h2 id="projects-heading">{t('featured')}</h2>
        <Link className="text-link text-meta" href="/projects">{t('allProjects', { count: projects.length })}</Link></div>
      {projects.some(p => p.is_featured) ? <ProjectList projects={projects.filter(p => p.is_featured).slice(0, 3)} locale={locale} headingLevel={3} /> : <p>{t('noProjects')}</p>}
    </section>
    <section className="section research-section" aria-labelledby="research-heading">
      <div className="section-heading"><h2 id="research-heading">{t('research')}</h2></div>
      <p>{t('noResearch')}</p>
    </section>
    <section className="contact-invitation"><h2>{t('invitation')}</h2><p className="mt-3 text-graphite">{t('invitationBody')}</p>
      <div className="actions">{email && <a className={buttonVariants()} href={email}>{site('write')}</a>}<ResumeLink profile={profile} locale={locale} /></div>
    </section>
  </Container></div>;
}
