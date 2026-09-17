import { getProfile } from '@/lib/db/profile';
import { resumeUrl } from '@/lib/urls';
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!['zh.pdf', 'en.pdf'].includes(file)) return new Response(null, { status: 404 });
  const locale = file.slice(0, 2);
  const profile = await getProfile();
  const url = resumeUrl(profile, locale);
  if (!url) return Response.redirect(new URL(`/${locale}/contact`, request.url), 303);
  return Response.redirect(new URL(url, request.url), 307);
}
