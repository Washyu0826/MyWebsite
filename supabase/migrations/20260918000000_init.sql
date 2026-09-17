-- =============================================================
-- 個人網站資料庫 Schema（Supabase / PostgreSQL）
-- 由 Supabase CLI 套用：supabase link --project-ref <id> && supabase db push
-- 原則：
--   1. 所有資料表開啟 RLS
--   2. anon 只能讀「已發布且發布時間已到」的內容
--   3. 所有寫入只透過 service_role（Server Actions / Route Handlers）
--   4. 雙語欄位一律 *_zh / *_en
--   5. 本檔可重複執行：trigger / policy 先 drop 再 create，
--      table / index 用 if not exists，function 用 create or replace，
--      seed 一律 on conflict / where not exists。
--   6. 不含任何示範內容；示範資料請用 supabase/seed.sql。
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- 列舉型別 ----------
do $$ begin
  create type content_status as enum ('draft', 'scheduled', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type experience_kind as enum ('work', 'education', 'award', 'activity');
exception when duplicate_object then null; end $$;

-- ---------- 共用：updated_at 觸發器 ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =============================================================
-- profile（單列）
-- =============================================================
create table if not exists profile (
  id                int primary key default 1 check (id = 1),
  name_zh           text not null default '',
  name_en           text not null default '',
  headline_zh       text not null default '',   -- 定位句（首頁大字下一行）
  headline_en       text not null default '',
  now_zh            text not null default '',   -- 「目前 ──」狀態列
  now_en            text not null default '',
  bio_zh            text not null default '',   -- Markdown
  bio_en            text not null default '',
  avatar_url        text,
  location_zh       text default '',
  location_en       text default '',
  email             text not null default '',
  resume_zh_url     text,                       -- Storage 公開網址
  resume_en_url     text,
  resume_updated_at timestamptz,
  seo_description_zh text default '',
  seo_description_en text default '',
  updated_at        timestamptz not null default now()
);
drop trigger if exists profile_updated on profile;
create trigger profile_updated before update on profile
  for each row execute function set_updated_at();

insert into profile (id) values (1) on conflict (id) do nothing;

-- =============================================================
-- social_links
-- =============================================================
create table if not exists social_links (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null,              -- github / linkedin / email / x / medium
  label       text not null default '',
  url         text not null,
  sort_order  int  not null default 0,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists social_links_order_idx on social_links (sort_order);

-- =============================================================
-- skills
-- =============================================================
create table if not exists skills (
  id            uuid primary key default gen_random_uuid(),
  category_zh   text not null,            -- 語言 / 前端 / 資料與 AI / 基礎設施
  category_en   text not null,
  category_order int not null default 0,
  name          text not null,            -- 技術名稱不翻譯
  sort_order    int  not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists skills_order_idx on skills (category_order, sort_order);

-- =============================================================
-- experiences
-- =============================================================
create table if not exists experiences (
  id             uuid primary key default gen_random_uuid(),
  kind           experience_kind not null default 'work',
  org_zh         text not null,
  org_en         text not null default '',
  role_zh        text not null default '',
  role_en        text not null default '',
  description_zh text default '',         -- Markdown，建議條列
  description_en text default '',
  start_date     date not null,
  end_date       date,                    -- null = 迄今
  is_current     boolean not null default false,
  url            text,
  sort_order     int not null default 0,
  is_visible     boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
drop trigger if exists experiences_updated on experiences;
create trigger experiences_updated before update on experiences
  for each row execute function set_updated_at();
create index if not exists experiences_sort_idx on experiences (kind, start_date desc);

-- =============================================================
-- projects
-- =============================================================
create table if not exists projects (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,

  -- 標題與摘要
  title_zh            text not null,
  title_en            text not null default '',
  summary_zh          text not null default '',   -- 一句話，列表用
  summary_en          text not null default '',

  -- 案例研究五段（Markdown）
  problem_zh          text default '',
  problem_en          text default '',
  solution_zh         text default '',
  solution_en         text default '',
  outcome_zh          text default '',
  outcome_en          text default '',
  contribution_zh     text default '',
  contribution_en     text default '',
  body_zh             text default '',            -- 實作細節
  body_en             text default '',

  -- 視覺
  cover_url           text,
  cover_alt_zh        text default '',
  cover_alt_en        text default '',
  architecture_url    text,
  architecture_alt_zh text default '',
  architecture_alt_en text default '',
  video_url           text,

  -- meta
  role_zh             text default '',
  role_en             text default '',
  team_size           int,
  period_start        date,
  period_end          date,
  tech_stack          text[] not null default '{}',
  tags                text[] not null default '{}',  -- 篩選用：web / data-ai / tool
  demo_url            text,
  repo_url            text,

  -- 發布
  status              content_status not null default 'draft',
  published_at        timestamptz,
  is_featured         boolean not null default false,
  sort_order          int not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
drop trigger if exists projects_updated on projects;
create trigger projects_updated before update on projects
  for each row execute function set_updated_at();

create index if not exists projects_public_idx
  on projects (status, published_at desc);
create index if not exists projects_sort_idx on projects (sort_order);
create index if not exists projects_tags_idx on projects using gin (tags);
create index if not exists projects_tech_idx on projects using gin (tech_stack);

-- =============================================================
-- project_media（截圖 / 影片）
-- =============================================================
create table if not exists project_media (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  url         text not null,
  media_type  text not null default 'image',   -- image | video
  width       int,
  height      int,
  alt_zh      text default '',
  alt_en      text default '',
  caption_zh  text default '',
  caption_en  text default '',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists project_media_idx on project_media (project_id, sort_order);

-- =============================================================
-- project_metrics（量化成果）
-- =============================================================
create table if not exists project_metrics (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  value       text not null,          -- "120ms" / "3,000+" / "40%"
  label_zh    text not null,          -- "P95 延遲"
  label_en    text not null default '',
  sort_order  int not null default 0
);
create index if not exists project_metrics_idx on project_metrics (project_id, sort_order);

-- =============================================================
-- posts（文章 / Blog）
-- =============================================================
create table if not exists posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title_zh        text not null,
  title_en        text not null default '',
  excerpt_zh      text default '',
  excerpt_en      text default '',
  body_zh         text default '',
  body_en         text default '',
  cover_url       text,
  cover_alt_zh    text default '',
  cover_alt_en    text default '',
  tags            text[] not null default '{}',
  reading_minutes int,
  status          content_status not null default 'draft',
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists posts_updated on posts;
create trigger posts_updated before update on posts
  for each row execute function set_updated_at();
create index if not exists posts_public_idx on posts (status, published_at desc);
create index if not exists posts_tags_idx on posts using gin (tags);

-- =============================================================
-- messages（聯絡表單）
-- =============================================================
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  subject     text default '',
  body        text not null,
  locale      text not null default 'zh',
  ip_hash     text,                       -- 雜湊後才存，不存原始 IP
  user_agent  text,
  is_read     boolean not null default false,
  is_replied  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists messages_idx on messages (created_at desc);

-- 聯絡表單速率限制（由 contact_rate_limit_hit() 原子更新，見下一個 migration）
create table if not exists contact_rate_limit (
  ip_hash     text primary key,
  hits        int not null default 1,
  window_start timestamptz not null default now()
);

-- =============================================================
-- media_assets（圖片庫）
-- =============================================================
create table if not exists media_assets (
  id          uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  url         text not null,
  mime_type   text not null,
  size_bytes  int,
  width       int,
  height      int,
  alt_zh      text default '',
  alt_en      text default '',
  created_at  timestamptz not null default now()
);

-- =============================================================
-- site_settings（鍵值設定）
-- =============================================================
create table if not exists site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
drop trigger if exists site_settings_updated on site_settings;
create trigger site_settings_updated before update on site_settings
  for each row execute function set_updated_at();

insert into site_settings (key, value) values
  ('nav', '{"showBlog": true, "showContact": true}'),
  ('seo', '{"defaultOgKind": "minimal"}')
on conflict (key) do nothing;

-- =============================================================
-- Row Level Security
-- =============================================================
alter table profile            enable row level security;
alter table social_links       enable row level security;
alter table skills             enable row level security;
alter table experiences        enable row level security;
alter table projects           enable row level security;
alter table project_media      enable row level security;
alter table project_metrics    enable row level security;
alter table posts              enable row level security;
alter table messages           enable row level security;
alter table contact_rate_limit enable row level security;
alter table media_assets       enable row level security;
alter table site_settings      enable row level security;

-- 公開可讀（靜態內容）
drop policy if exists "public read profile"  on profile;
create policy "public read profile"   on profile      for select to anon, authenticated using (true);
drop policy if exists "public read social"   on social_links;
create policy "public read social"    on social_links for select to anon, authenticated using (is_visible);
drop policy if exists "public read skills"   on skills;
create policy "public read skills"    on skills       for select to anon, authenticated using (is_visible);
drop policy if exists "public read exp"      on experiences;
create policy "public read exp"       on experiences  for select to anon, authenticated using (is_visible);
drop policy if exists "public read settings" on site_settings;
create policy "public read settings"  on site_settings for select to anon, authenticated using (true);

-- 公開可讀（受發布狀態控制）
drop policy if exists "public read projects" on projects;
create policy "public read projects" on projects for select to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "public read posts" on posts;
create policy "public read posts" on posts for select to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "public read project media" on project_media;
create policy "public read project media" on project_media for select to anon, authenticated
  using (exists (
    select 1 from projects p
    where p.id = project_media.project_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
  ));

drop policy if exists "public read project metrics" on project_metrics;
create policy "public read project metrics" on project_metrics for select to anon, authenticated
  using (exists (
    select 1 from projects p
    where p.id = project_metrics.project_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
  ));

-- messages / contact_rate_limit / media_assets：不給任何公開存取
-- （不建立 policy = 預設拒絕，只有 service_role 能操作）

-- =============================================================
-- Storage buckets
-- 重跑時會同步 public / 大小上限 / MIME 白名單（不允許 SVG 上傳）
-- =============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media',  'media',  true, 8388608,
   array['image/png','image/jpeg','image/webp','image/gif']),
  ('resume', 'resume', true, 8388608,
   array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read media bucket" on storage.objects;
create policy "public read media bucket" on storage.objects
  for select to anon, authenticated using (bucket_id in ('media', 'resume'));
-- 上傳一律走 service_role，不開放 anon 寫入

-- =============================================================
-- 排程發布：把時間已到的 scheduled 轉成 published
-- 由 /api/cron/publish 以 service_role client 呼叫
-- =============================================================
create or replace function publish_due_content()
returns table (kind text, slug text)
language plpgsql security definer
set search_path = public
as $$
begin
  return query
  with p as (
    update projects set status = 'published'
    where status = 'scheduled' and published_at <= now()
    returning 'project'::text as kind, projects.slug
  ), b as (
    update posts set status = 'published'
    where status = 'scheduled' and published_at <= now()
    returning 'post'::text as kind, posts.slug
  )
  select * from p union all select * from b;
end $$;

revoke all on function publish_due_content() from public, anon, authenticated;
grant execute on function publish_due_content() to service_role;
