import { revalidateTag } from 'next/cache';
import { adminDb } from '@/lib/db/admin';

export const dynamic = 'force-dynamic';

type PublishedRow = { kind: 'project' | 'post' | string; slug: string };

// Vercel Cron calls GET with `Authorization: Bearer ${CRON_SECRET}`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let client: ReturnType<typeof adminDb>;
  try { client = adminDb(); }
  catch { return Response.json({ error: 'Missing server-side Supabase credentials.' }, { status: 500 }); }

  // Local type keeps this compiling whether or not src/types/database.ts declares the RPC.
  const { data, error } = await client.rpc('publish_due_content' as never) as unknown as
    { data: PublishedRow[] | null; error: { message: string } | null };
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).filter(row => typeof row?.slug === 'string' && row.slug.length > 0);
  for (const row of rows) {
    const list = row.kind === 'project' ? 'projects' : 'posts';
    const item = row.kind === 'project' ? `project:${row.slug}` : `post:${row.slug}`;
    revalidateTag(list);
    revalidateTag(item);
  }
  // Listing pages depend on published_at reaching now() even when nothing flipped status.
  revalidateTag('posts');
  revalidateTag('projects');

  return Response.json({ published: rows });
}
