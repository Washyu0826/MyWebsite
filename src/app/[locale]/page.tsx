import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { Github, Linkedin, Mail } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/db/profile';
import { listProjects } from '@/lib/db/projects';
import { listExperiences } from '@/lib/db/profile';
import { pickLocale } from '@/lib/locale';
import { emailUrl, gmailComposeUrl, safeUrl } from '@/lib/urls';
import { pageMetadata } from '@/lib/metadata';
import { personSchema } from '@/lib/structured-data';
import { Container } from '@/components/container';
import { SectionReveal } from '@/components/section-reveal';
import { ProjectList } from '@/components/project-list';
import { HomeSections } from '@/components/home-sections';
import { CubistBackdrop } from '@/components/cubist-backdrop';
import { ResumeLink } from '@/components/resume-link';
import { buttonVariants } from '@/components/ui/button';
import { JsonLd } from '@/components/json-ld';
import { PwaRegister } from '@/app/offline/pwa-register';
type Props = { params: Promise<{ locale: Locale }> };
const heroAlias = 'Zenobia';
const heroHeadline = 'Software Engineer';
const focusAreas = ['Multimodal AI', 'AI Agent / MCP', 'GraphRAG', 'Full Stack', 'DevOps'];
const heroTagline = 'Curiosity driven, clarity obsessed.';
const designPrinciples = ['why', 'candid', 'iteration'];

function TypewriterLine({ as: Tag = 'p', text, className, id, delay = 0 }: {
  as?: 'p' | 'h1';
  text: string;
  className?: string;
  id?: string;
  delay?: number;
}) {
  return <Tag
    id={id}
    className={['typewriter-line', className].filter(Boolean).join(' ')}
    style={{
      '--type-line-delay': `${delay}ms`,
      '--type-duration': `${Math.max(260, text.length * 34)}ms`,
      '--type-steps': text.length,
    } as React.CSSProperties}
  >
    <span className="sr-only">{text}</span>
    <span className="typewriter-text" aria-hidden="true">{text}</span>
  </Tag>;
}

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
  const [profile, projects, experiences, t, site] = await Promise.all([getProfile(), listProjects(), listExperiences(), getTranslations('Home'), getTranslations('Site')]);
  const p = pickLocale(profile, locale);
  const email = emailUrl(profile.email);
  const nowParts = p.now.split(' · ');
  const featured = projects.filter(project => project.is_featured).slice(0, 3);
  // Same @id as the contact page: one person described in two places, which crawlers merge.
  const person = personSchema({
    name: p.name, locale, jobTitle: heroHeadline, description: p.bio, email: profile.email, image: profile.avatar_url,
    sameAs: profile.social_links.map(link => safeUrl(link.url)),
    alumniOf: experiences.filter(row => row.kind === 'education').map(row => pickLocale(row, locale).org),
  });
  return <div className="home-stage"><JsonLd nodes={[person]} /><PwaRegister /><CubistBackdrop /><Container className="home-container">
    <section className="hero" aria-labelledby="intro-heading">
      <div className={profile.avatar_url ? 'hero-grid' : 'hero-grid hero-grid-text-only'}>
        <div>
          <div className="hero-typewriter" aria-label={`${heroAlias}. ${heroHeadline}. ${heroTagline}`}>
            <TypewriterLine text={heroAlias} className="mb-5 text-meta text-graphite" />
            <TypewriterLine as="h1" id="intro-heading" text={heroHeadline} delay={420} />
            <div className="positioning"><TypewriterLine text={heroTagline} delay={1120} /></div>
          </div>
          <div className="status-line"><span>{t('now')}</span><span>{nowParts.length > 1 ? <>
            {nowParts[0]} <span aria-hidden="true">·</span> <strong>{nowParts.slice(1).join(' · ')}</strong>
          </> : p.now}</span></div>
          <HeroSocialLinks profile={profile} label={site('socialLinks')} />
          <ul className="hero-focus-list" aria-label={t('hashtags')}>
            {focusAreas.map(area => <li key={area}>{area}</li>)}
          </ul>
          <SectionReveal as="div" className="signature-block" deferInitial>
            <div className="enter-rule" aria-hidden="true" />
            <div className="signature-principles" aria-label={t('principles.label')}>
              {designPrinciples.map((key, index) => <div key={key} className="signature-principle" style={{ '--enter-index': index } as React.CSSProperties}>
                <span>{`0${index + 1}`}</span>
                <strong>{t(`principles.${key}.title`)}</strong>
                <p>{t(`principles.${key}.body`)}</p>
              </div>)}
            </div>
          </SectionReveal>
          <div className="mt-6 md:hidden"><ResumeLink profile={profile} locale={locale} /></div>
        </div>
        {profile.avatar_url && <div className="hero-photo"><div className="hero-photo-inner">
          <Image src={profile.avatar_url} alt={p.name} width={560} height={700} priority sizes="(min-width: 768px) 440px, 100vw" />
        </div></div>}
      </div>
    </section>
    <HomeSections locale={locale} />
    <SectionReveal className="section project-section" aria-labelledby="projects-heading">
      <div className="section-heading"><h2 id="projects-heading" className="enter-item">{t('featured')}</h2>
        <Link className="text-link text-meta enter-item" href="/projects">{t('allProjects', { count: projects.length })}</Link></div>
      {featured.length ? <ProjectList projects={featured} locale={locale} headingLevel={3} /> : <p className="enter-item">{t('noProjects')}</p>}
    </SectionReveal>
    <SectionReveal className="section research-section" aria-labelledby="research-heading">
      <div className="section-heading"><h2 id="research-heading" className="enter-item">{t('research')}</h2></div>
      <p className="enter-item">{t('noResearch')}</p>
    </SectionReveal>
    <section className="contact-invitation"><h2>{t('invitation')}</h2><p className="mt-3 text-graphite">{t('invitationBody')}</p>
      <div className="actions">{email && <a className={buttonVariants()} href={email}>{site('write')}</a>}<ResumeLink profile={profile} locale={locale} /></div>
    </section>
  </Container></div>;
}
