import 'server-only';
import { unstable_cache } from 'next/cache';
import { publicDb } from './server';
import { isDemoMode } from './config';
import { demoProjects, demoMedia, demoMetrics } from '@/lib/demo/projects';

function warnProjectsUnavailable(message: string, error: unknown) {
  console.warn(message, error);
}

export const listProjects = unstable_cache(async (options: { tag?: string; limit?: number } = {}) => {
  if (isDemoMode()) {
    const filtered = demoProjects.filter(p => !options.tag || p.tags.includes(options.tag));
    return options.limit === undefined ? filtered : filtered.slice(0, options.limit);
  }
  let query = publicDb().from('projects').select('*').eq('status', 'published')
    .lte('published_at', new Date().toISOString()).order('sort_order').order('id');
  if (options.tag) query = query.contains('tags', [options.tag]);
  if (options.limit !== undefined) query = query.limit(Math.max(0, options.limit));
  const { data, error } = await query;
  if (error) {
    warnProjectsUnavailable('Unable to load projects; using fallback project data.', error);
    const filtered = demoProjects.filter(p => !options.tag || p.tags.includes(options.tag));
    return options.limit === undefined ? filtered : filtered.slice(0, options.limit);
  }
  return data;
}, ['projects'], { tags: ['projects'], revalidate: 300 });

export function getProjectBySlug(slug: string) {
  return unstable_cache(async () => {
    const projects = await listProjects();
    const index = projects.findIndex(p => p.slug === slug);
    if (index === -1) return null;
    const project = projects[index];
    let media = demoMedia.filter(m => m.project_id === project.id);
    let metrics = demoMetrics.filter(m => m.project_id === project.id);
    if (!isDemoMode()) {
      const db = publicDb();
      const [images, numbers] = await Promise.all([
        db.from('project_media').select('*').eq('project_id', project.id).order('sort_order').order('id'),
        db.from('project_metrics').select('*').eq('project_id', project.id).order('sort_order').order('id'),
      ]);
      if (images.error || numbers.error) {
        warnProjectsUnavailable(`Unable to load project details for "${slug}"; using fallback detail data.`, images.error || numbers.error);
      } else {
        media = images.data; metrics = numbers.data;
      }
    }
    return { ...project, media, metrics, previous: projects[index - 1] ?? null, next: projects[index + 1] ?? null };
  }, ['project', slug], { tags: ['projects', `project:${slug}`], revalidate: 300 })();
}
