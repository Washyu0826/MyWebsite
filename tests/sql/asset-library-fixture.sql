-- Local PostgreSQL test double for Supabase-owned schemas, never run in Supabase.
do $$ begin
  if current_database() <> 'asset_library_test' then raise exception 'TEST_DATABASE_REQUIRED'; end if;
end $$;
do $$ begin
  if not exists(select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
end $$;
create schema if not exists auth;
create schema if not exists storage;
create table if not exists auth.users(id uuid primary key);
create table if not exists storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects(bucket_id text, name text, metadata jsonb, unique(bucket_id,name));
create table if not exists public.profile(id integer primary key, avatar_url text, resume_en_url text, resume_zh_url text, resume_updated_at timestamptz, updated_at timestamptz);
create table if not exists public.projects(id uuid primary key default gen_random_uuid(), slug text, title_zh text default '', title_en text default '',
  problem_zh text default '', problem_en text default '', solution_zh text default '', solution_en text default '', outcome_zh text default '', outcome_en text default '',
  contribution_zh text default '', contribution_en text default '', body_zh text default '', body_en text default '', cover_url text, architecture_url text);
create table if not exists public.project_media(id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id), url text not null);
create table if not exists public.posts(id uuid primary key default gen_random_uuid(), slug text, title_zh text default '', title_en text default '',
  excerpt_zh text default '', excerpt_en text default '', body_zh text default '', body_en text default '', cover_url text);

