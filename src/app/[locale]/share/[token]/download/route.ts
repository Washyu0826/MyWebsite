import { redeemShare } from '@/lib/assets/shares';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ locale: string; token: string }> };

function backToPage(request: Request, locale: string, token: string, failed: boolean) {
  const url = new URL(`/${locale}/share/${encodeURIComponent(token)}`, request.url);
  if (failed) url.searchParams.set('error', '1');
  return Response.redirect(url, 303);
}

/**
 * Spends one open and sends the reader to a 60-second signed URL for the private original.
 *
 * Only POST redeems: the landing page submits a form, so a mail scanner or link previewer following
 * the address cannot burn an open. A stray GET just returns to the page.
 */
export async function POST(request: Request, { params }: Context) {
  const { locale, token } = await params;
  const result = await redeemShare(token);
  if (!result) return backToPage(request, locale, token, true);
  return new Response(null, {
    status: 303,
    headers: { Location: result.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

export async function GET(request: Request, { params }: Context) {
  const { locale, token } = await params;
  return backToPage(request, locale, token, false);
}
