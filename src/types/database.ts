// Schema-aligned bootstrap types. Replace with `npm run db:types` after connecting Supabase.
import type { ContactMessage, ContactRateLimit, Experience, Post, Profile, Project, ProjectMedia, ProjectMetric, Skill, SocialLink } from './content';
import type { Asset, AssetVersion, AssetPublication, AssetEvent, AssetShare } from '@/lib/assets/model';
import type { PostRevision } from '@/lib/revisions';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      assets: Table<Asset>;
      asset_versions: Table<AssetVersion>;
      asset_publications: Table<AssetPublication>;
      asset_events: Table<AssetEvent>;
      asset_shares: Table<AssetShare & { owner_id: string; token_hash: string }>;
      profile: Table<Profile>;
      social_links: Table<SocialLink>;
      skills: Table<Skill>;
      experiences: Table<Experience>;
      projects: Table<Project>;
      project_media: Table<ProjectMedia>;
      project_metrics: Table<ProjectMetric>;
      posts: Table<Post>;
      post_revisions: Table<PostRevision>;
      site_settings: Table<{ key: string; value: Json; updated_at: string }>;
      messages: Table<ContactMessage>;
      contact_rate_limit: Table<ContactRateLimit>;
    };
    Views: { [_ in never]: never };
    Functions: {
      asset_library_usage: { Args: Record<string, never>; Returns: number };
      asset_begin_upload: { Args: { p_actor: string; p_request: string; p_name: string; p_mime: string; p_size: number; p_asset?: string }; Returns: Json };
      asset_finish_upload: { Args: { p_actor: string; p_version: string; p_size: number; p_mime: string; p_hash: string }; Returns: Json };
      asset_upload_error: { Args: { p_actor: string; p_version: string; p_error: string; p_reject?: boolean }; Returns: undefined };
      asset_change: { Args: { p_actor: string; p_asset: string; p_action: string; p_value?: string }; Returns: Json };
      asset_prepare_publish: { Args: { p_actor: string; p_version: string; p_slot: string; p_request: string }; Returns: Json };
      asset_finish_publish: { Args: { p_actor: string; p_operation: string; p_url: string }; Returns: Json };
      asset_publication_payload: { Args: { p_actor: string; p_operation: string; p_hash: string; p_mime: string; p_size: number }; Returns: Json };
      asset_references: { Args: { p_actor: string; p_asset: string }; Returns: Json };
      post_save_revision: { Args: { p_actor: string | null; p_post: string; p_snapshot: Record<string, unknown>; p_reason?: string }; Returns: Json };
      asset_revoke_publication: { Args: { p_actor: string; p_publication: string }; Returns: Json };
      asset_create_share: { Args: { p_actor: string; p_version: string; p_hash: string; p_expires: string; p_max_opens: number | null; p_label: string | null }; Returns: Json };
      asset_peek_share: { Args: { p_hash: string }; Returns: Json };
      asset_redeem_share: { Args: { p_hash: string }; Returns: Json };
      asset_revoke_share: { Args: { p_actor: string; p_share: string }; Returns: Json };
      asset_publication_purged: { Args: { p_actor: string; p_publication: string }; Returns: Json };
      publish_due_content: { Args: Record<string, never>; Returns: { kind: string; slug: string }[] };
      contact_rate_limit_hit: { Args: { p_ip_hash: string; p_limit: number; p_window: string }; Returns: boolean };
    };
    Enums: { content_status: Project['status']; experience_kind: Experience['kind'] };
    CompositeTypes: { [_ in never]: never };
  };
};
