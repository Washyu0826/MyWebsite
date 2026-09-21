export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type Bilingual<K extends string> = Record<`${K}_zh` | `${K}_en`, string>;
export type Profile = Bilingual<'name' | 'headline' | 'now' | 'bio'> & {
  id: number; email: string; avatar_url: string | null;
  location_zh: string | null; location_en: string | null;
  seo_description_zh: string | null; seo_description_en: string | null;
  resume_zh_url: string | null; resume_en_url: string | null;
  resume_updated_at: string | null; updated_at: string;
};
export type SocialLink = {
  id: string; platform: string; label: string; url: string;
  sort_order: number; is_visible: boolean; created_at: string;
};
export type Skill = Bilingual<'category'> & {
  id: string; name: string; category_order: number; sort_order: number;
  is_visible: boolean; created_at: string;
};
export type Experience = Bilingual<'org' | 'role'> & {
  id: string; kind: 'work' | 'education' | 'award' | 'activity';
  description_zh: string | null; description_en: string | null;
  start_date: string; end_date: string | null; is_current: boolean;
  url: string | null; logo_url: string | null; sort_order: number; is_visible: boolean;
  created_at: string; updated_at: string;
};
export type Project = Bilingual<'title' | 'summary'> & {
  id: string; slug: string;
  problem_zh: string | null; problem_en: string | null;
  solution_zh: string | null; solution_en: string | null;
  outcome_zh: string | null; outcome_en: string | null;
  contribution_zh: string | null; contribution_en: string | null;
  body_zh: string | null; body_en: string | null;
  cover_url: string | null; cover_alt_zh: string | null; cover_alt_en: string | null;
  architecture_url: string | null;
  architecture_alt_zh: string | null; architecture_alt_en: string | null;
  video_url: string | null; role_zh: string | null; role_en: string | null;
  team_size: number | null; period_start: string | null; period_end: string | null;
  tech_stack: string[]; tags: string[]; demo_url: string | null; repo_url: string | null;
  status: ContentStatus; published_at: string | null; is_featured: boolean;
  sort_order: number; created_at: string; updated_at: string;
};
export type ProjectMedia = {
  id: string; project_id: string; url: string; media_type: string;
  width: number | null; height: number | null;
  alt_zh: string | null; alt_en: string | null;
  caption_zh: string | null; caption_en: string | null;
  sort_order: number; created_at: string;
};
export type ProjectMetric = Bilingual<'label'> & {
  id: string; project_id: string; value: string; sort_order: number;
};
export type Post = Bilingual<'title'> & {
  id: string; slug: string; excerpt_zh: string | null; excerpt_en: string | null;
  body_zh: string | null; body_en: string | null; cover_url: string | null;
  cover_alt_zh: string | null; cover_alt_en: string | null;
  tags: string[]; reading_minutes: number | null; status: ContentStatus;
  published_at: string | null; created_at: string; updated_at: string;
};
export type ContactMessage = {
  id: string; name: string; email: string; subject: string; body: string; locale: string;
  ip_hash: string | null; user_agent: string | null; is_read: boolean; is_replied: boolean; created_at: string;
};
export type ContactRateLimit = { ip_hash: string; hits: number; window_start: string };
