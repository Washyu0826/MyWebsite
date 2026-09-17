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

export const countPosts = unstable_cache(async ({ tag }: { tag?: string } = {}): Promise<number> => {
  if (isDemoMode()) return 0;
  let query = publicDb().from('posts').select('id', { count: 'exact', head: true }).eq('status', 'published')
    .lte('published_at', new Date().toISOString());
  if (tag) query = query.contains('tags', [tag]);
  const { count, error } = await query;
  if (error) throw new Error('Unable to count posts.');
  return count ?? 0;
}, ['post-count'], { tags: ['posts'], revalidate: 300 });

export const listPostTags = unstable_cache(async (): Promise<{ tag: string; count: number }[]> => {
  if (isDemoMode()) return [];
  const { data, error } = await publicDb().from('posts').select('tags').eq('status', 'published')
    .lte('published_at', new Date().toISOString());
  if (error) throw new Error('Unable to load article tags.');
  const counts = new Map<string, number>();
  for (const tag of data.flatMap(post => post.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}, ['post-tags'], { tags: ['posts'], revalidate: 300 });

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
