import { emailUrl, safeUrl } from './urls';

export type ContactLinkKind = 'email' | 'phone' | 'line' | 'instagram' | 'linkedin' | 'github' | 'x' | 'link';

export type ContactLink = {
  key: string;
  kind: ContactLinkKind;
  /** Label from the database, or '' when the caller should supply a default for `kind`. */
  label: string;
  href: string;
  /** Human-readable value shown next to the label (no scheme, no trailing slash). */
  display: string;
  /** What the copy button puts on the clipboard. */
  copyValue: string;
};

const platformKinds: Record<string, ContactLinkKind> = {
  email: 'email', gmail: 'email', mail: 'email',
  phone: 'phone', tel: 'phone', mobile: 'phone',
  line: 'line',
  instagram: 'instagram', ig: 'instagram',
  linkedin: 'linkedin',
  github: 'github',
  x: 'x', twitter: 'x',
};

const hostKinds: Array<[RegExp, ContactLinkKind]> = [
  [/(^|\.)line\.me$/, 'line'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)github\.com$/, 'github'],
  [/(^|\.)(x|twitter)\.com$/, 'x'],
];

/** Accepts http(s), mailto: and tel: values; returns a normalised href or null. */
export function contactHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('mailto:')) return emailUrl(trimmed.slice(7).trim());
  if (lower.startsWith('tel:')) {
    const digits = trimmed.slice(4).replace(/[^\d+]/g, '');
    return /^\+?\d{6,20}$/.test(digits) ? `tel:${digits}` : null;
  }
  return safeUrl(trimmed);
}

export function displayUrl(value: string): string {
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

function kindFor(platform: string, href: string): ContactLinkKind {
  const byPlatform = platformKinds[platform.trim().toLowerCase()];
  if (byPlatform) return byPlatform;
  if (href.startsWith('mailto:')) return 'email';
  if (href.startsWith('tel:')) return 'phone';
  try {
    const host = new URL(href).hostname.toLowerCase();
    const match = hostKinds.find(([pattern]) => pattern.test(host));
    if (match) return match[1];
  } catch { /* not a URL */ }
  return 'link';
}

function handleFrom(href: string, kind: ContactLinkKind): string | null {
  try {
    const url = new URL(href);
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '');
    if (kind === 'line') {
      // https://line.me/ti/p/~id  or  https://line.me/R/ti/p/@id
      const match = path.match(/\/ti\/p\/[~@]?([^/]+)$/);
      return match ? match[1] : null;
    }
    if (kind === 'instagram' || kind === 'x') {
      const match = path.match(/^\/@?([^/]+)$/);
      return match ? match[1] : null;
    }
  } catch { /* ignore */ }
  return null;
}

/** Turns a social_links row into something the contact page can render. Returns null for unsupported URLs. */
export function describeSocialLink(link: { id: string; platform: string; label: string | null; url: string }): ContactLink | null {
  const href = contactHref(link.url);
  if (!href) return null;
  const kind = kindFor(link.platform, href);
  const raw = link.url.trim();
  let display: string;
  if (kind === 'email') display = href.slice(7) && decodeURIComponent(href.slice(7));
  else if (kind === 'phone') display = raw.replace(/^tel:/i, '').trim() || href.slice(4);
  else display = handleFrom(href, kind) ?? displayUrl(raw);
  const copyValue = kind === 'line' || kind === 'instagram' || kind === 'x' ? display : (kind === 'email' || kind === 'phone' ? display : href);
  return { key: link.id, kind, label: (link.label || '').trim(), href, display, copyValue };
}

export function isExternalHref(href: string): boolean {
  return /^https?:/i.test(href);
}
