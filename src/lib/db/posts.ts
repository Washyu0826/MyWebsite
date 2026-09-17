import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Post } from '@/types/content';
import { publicDb } from './server';
import { isDemoMode } from './config';
export const listPosts = unstable_cache(async ({ tag, page = 1, limit = 20 }: { tag?: string; page?: number; limit?: number } = {}): Promise<Post[]> => {
  if (isDemoMode()) return [];
  const pageSize = Math.max(1, Math.min(50, Math.floor(limit)));
  const offset = (Math.max(1, Math.floor(page)) - 1) * pageSize;
  let query = publicDb().from('posts').select('*').eq('status', 'published')
    .lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).order('id')
    .range(offset, offset + pageSize - 1);
  if (tag) query = query.contains('tags', [tag]);
  const { data, error } = await query;
  if (error) throw new Error('Unable to load posts.');
  return data;
}, ['posts'], { tags: ['posts'], revalidate: 300 });

export function getPostBySlug(slug: string) {
  return unstable_cache(async (): Promise<Post | null> => {
    if (isDemoMode()) return null;
    const { data, error } = await publicDb().from('posts').select('*').eq('slug', slug)
      .eq('status', 'published').lte('published_at', new Date().toISOString()).maybeSingle();
    if (error) throw new Error('Unable to load post.');
    return data;
  }, ['post', slug], { tags: ['posts', `post:${slug}`], revalidate: 300 })();
}

export const listPostSlugs = unstable_cache(async () => {
  if (isDemoMode()) return [];
  const { data, error } = await publicDb().from('posts').select('slug').eq('status', 'published')
    .lte('published_at', new Date().toISOString()).order('published_at', { ascending: false });
  if (error) throw new Error('Unable to load article slugs.');
  return data.map(post => ({ slug: post.slug }));
}, ['post-slugs'], { tags: ['posts'], revalidate: 300 });
