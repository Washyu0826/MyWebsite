import { assetHandler } from '@/lib/assets/http';

export const runtime = 'nodejs';

// Retired multipart endpoint: uploads now go straight to private Storage on a signed upload URL.
export async function POST(request: Request) {
  const authorization = await assetHandler(request, async () => null);
  if (!authorization.ok) return authorization;
  return Response.json({ ok: false, message: '請重新整理素材庫，以新版上傳流程更新個人照。' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
