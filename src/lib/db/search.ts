import 'server-only';
import { unstable_cache } from 'next/cache';
import { publicDb } from './server';
import { isDemoMode } from './config';
import { demoProjects } from '@/lib/demo/projects';

export type SearchItem = {
  type: 'project' | 'article';
  slug: string;
  title_zh: string;
  title_en: string;
  summary_zh: string;
  summary_en: string;
  tags: string[];
};

function trim(value: string | null | undefined) {
  return (value || '').slice(0, 160);
}

/**
 * Light index for the command palette: titles, one-line summaries and tags only.
 * The palette is an enhancement, so a query failure degrades to an empty index
 * instead of throwing and taking the whole layout down with it.
 */
export const listSearchItems = unstable_cache(async (): Promise<SearchItem[]> => {
  if (isDemoMode()) {
    return demoProjects.map(project => ({
      type: 'project' as const,
      slug: project.slug,
      title_zh: project.title_zh,
      title_en: project.title_en,
      summary_zh: trim(project.summary_zh),
      summary_en: trim(project.summary_en),
      tags: project.tags,
    }));
  }

  const db = publicDb();
  const now = new Date().toISOString();
  const [projects, posts] = await Promise.all([
    db.from('projects').select('slug,title_zh,title_en,summary_zh,summary_en,tags')
      .eq('status', 'published').lte('published_at', now).order('sort_order').order('id'),
    db.from('posts').select('slug,title_zh,title_en,excerpt_zh,excerpt_en,tags')
      .eq('status', 'published').lte('published_at', now).order('published_at', { ascending: false }).order('id'),
  ]);

  if (projects.error || posts.error) {
    console.error('Search index unavailable:', projects.error?.message || posts.error?.message);
    return [];
  }

  return [
    ...projects.data.map(row => ({
      type: 'project' as const, slug: row.slug,
      title_zh: row.title_zh, title_en: row.title_en,
      summary_zh: trim(row.summary_zh), summary_en: trim(row.summary_en),
      tags: row.tags ?? [],
    })),
    ...posts.data.map(row => ({
      type: 'article' as const, slug: row.slug,
      title_zh: row.title_zh, title_en: row.title_en,
      summary_zh: trim(row.excerpt_zh), summary_en: trim(row.excerpt_en),
      tags: row.tags ?? [],
    })),
  ];
}, ['search-index'], { tags: ['projects', 'posts'], revalidate: 300 });
