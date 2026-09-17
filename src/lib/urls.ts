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
export function resumeUrl(profile: { resume_zh_url: string | null; resume_en_url: string | null }, locale: string) {
  return documentUrl(locale === 'en' ? profile.resume_en_url : profile.resume_zh_url);
}
