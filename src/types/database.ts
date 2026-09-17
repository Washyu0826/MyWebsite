// Schema-aligned bootstrap types. Replace with `npm run db:types` after connecting Supabase.
import type { ContactMessage, ContactRateLimit, Experience, Post, Profile, Project, ProjectMedia, ProjectMetric, Skill, SocialLink } from './content';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      profile: Table<Profile>;
      social_links: Table<SocialLink>;
      skills: Table<Skill>;
      experiences: Table<Experience>;
      projects: Table<Project>;
      project_media: Table<ProjectMedia>;
      project_metrics: Table<ProjectMetric>;
      posts: Table<Post>;
      site_settings: Table<{ key: string; value: Json; updated_at: string }>;
      messages: Table<ContactMessage>;
      contact_rate_limit: Table<ContactRateLimit>;
    };
    Views: { [_ in never]: never };
    Functions: {
      publish_due_content: { Args: Record<string, never>; Returns: { kind: string; slug: string }[] };
      contact_rate_limit_hit: { Args: { p_ip_hash: string; p_limit: number; p_window: string }; Returns: boolean };
    };
    Enums: { content_status: Project['status']; experience_kind: Experience['kind'] };
    CompositeTypes: { [_ in never]: never };
  };
};
