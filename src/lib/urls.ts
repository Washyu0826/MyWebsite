export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
export function documentUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return safeUrl(value);
}
export function emailUrl(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${encodeURIComponent(value)}` : null;
}
export function gmailComposeUrl(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(value)}` : null;
}
export function resumeUrl(profile: { resume_zh_url: string | null; resume_en_url: string | null }, locale: string) {
  const normalized = locale === 'zh' ? 'zh' : 'en';
  const uploaded = documentUrl(normalized === 'en' ? profile.resume_en_url : profile.resume_zh_url);
  return uploaded ?? `/resumes/kuan-yu-hsien-resume-${normalized}.pdf`;
}
export type ClassifiedHref =
  | { kind: 'external' | 'internal' | 'anchor'; href: string }
  | { kind: 'rejected' };
// Markdown link policy: absolute http(s), site-relative paths (locale prefix stripped) and in-page anchors only.
export function classifyHref(value: string | null | undefined): ClassifiedHref {
  if (!value) return { kind: 'rejected' };
  const external = safeUrl(value);
  if (external) return { kind: 'external', href: external };
  if (value.startsWith('#')) return { kind: 'anchor', href: value };
  if (value.startsWith('/') && !value.startsWith('//')) {
    const stripped = value.replace(/^\/(?:zh|en)(?=[/?#]|$)/, '');
    return { kind: 'internal', href: stripped.startsWith('/') ? stripped : `/${stripped}` };
  }
  return { kind: 'rejected' };
}
