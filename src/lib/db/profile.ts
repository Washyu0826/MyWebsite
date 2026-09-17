import 'server-only';
import { unstable_cache } from 'next/cache';
import { publicDb } from './server';
import { isDemoMode } from './config';
import { demoExperiences, demoProfile, demoSocial } from '@/lib/demo/profile';

export const getProfile = unstable_cache(async () => {
  if (isDemoMode()) return { ...demoProfile, social_links: demoSocial };
  const db = publicDb();
  const [profile, social] = await Promise.all([
    db.from('profile').select('*').eq('id', 1).single(),
    db.from('social_links').select('*').eq('is_visible', true).order('sort_order').order('id'),
  ]);
  if (profile.error || social.error) throw new Error('Unable to load profile.');
  return { ...profile.data, social_links: social.data };
}, ['profile-v2'], { tags: ['profile'], revalidate: 30 });

export const listExperiences = unstable_cache(async () => {
  if (isDemoMode()) return demoExperiences;
  const { data, error } = await publicDb().from('experiences').select('*')
    .eq('is_visible', true).order('sort_order').order('start_date', { ascending: false }).order('id');
  if (error) throw new Error('Unable to load experiences.');
  return data;
}, ['experience'], { tags: ['experience'], revalidate: 300 });
