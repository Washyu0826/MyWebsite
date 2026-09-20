-- Article revisions: every successful save keeps the content that was stored, so a bad edit can be
-- compared and restored. Additive; replaces asset_references() so a retained revision is reported
-- as a soft reference instead of silently losing the image it points at.
begin;

create table if not exists public.post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  revision integer not null,
  -- The editable fields exactly as they were stored; restoring reads them straight back.
  snapshot jsonb not null,
  actor_id uuid references auth.users(id),
  -- 'save' or 'restore': why this snapshot exists.
  reason text not null default 'save' check (reason in ('save', 'restore')),
  created_at timestamptz not null default now(),
  unique(post_id, revision)
);

create index if not exists post_revisions_post_idx on public.post_revisions(post_id, revision desc);

alter table public.post_revisions enable row level security;
revoke all on public.post_revisions from anon, authenticated;
grant all on public.post_revisions to service_role;

-- Appends the next revision for a post. Returns the stored row, or the existing latest one when the
-- snapshot is identical, so pressing save twice does not fill the history with copies.
create or replace function public.post_save_revision(p_actor uuid, p_post uuid, p_snapshot jsonb, p_reason text default 'save')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare latest public.post_revisions; created public.post_revisions;
begin
  if p_post is null or p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then raise exception 'INVALID_REQUEST'; end if;
  if p_reason not in ('save', 'restore') then raise exception 'INVALID_REQUEST'; end if;
  perform 1 from public.posts where id = p_post for update;
  if not found then raise exception 'POST_NOT_FOUND'; end if;
  select * into latest from public.post_revisions where post_id = p_post order by revision desc limit 1;
  if found and latest.snapshot = p_snapshot then return to_jsonb(latest); end if;
  insert into public.post_revisions(post_id, revision, snapshot, actor_id, reason)
    values(p_post, coalesce(latest.revision, 0) + 1, p_snapshot, p_actor, p_reason)
    returning * into created;
  return to_jsonb(created);
end; $$;

-- Same as 20260920000300 plus retained article revisions. A revision reference is soft: it does not
-- block recycling or revoking, because the live site no longer shows it, but restoring that revision
-- afterwards would point at a removed file, so the inspector lists it as a warning.
create or replace function public.asset_references(p_actor uuid, p_asset uuid) returns jsonb
language plpgsql security definer set search_path = '' stable as $$
declare result jsonb;
begin
  select coalesce(jsonb_agg(r order by r->>'kind', r->>'title', r->>'field'), '[]'::jsonb) into result from (
    select jsonb_build_object('publication_id', p.id, 'url', p.public_url, 'kind', 'profile', 'id', null, 'slug', null, 'title', s.slot, 'field', s.slot, 'soft', false) as r
      from public.asset_publications p
      cross join public.profile f
      cross join lateral (values ('avatar', f.avatar_url), ('resume_zh', f.resume_zh_url), ('resume_en', f.resume_en_url)) as s(slot, url)
      where p.asset_id = p_asset and p.owner_id = p_actor and p.status = 'complete' and p.public_url <> ''
        and f.id = 1 and s.url = p.public_url
    union all
    select jsonb_build_object('publication_id', p.id, 'url', p.public_url, 'kind', 'project', 'id', j.id, 'slug', j.slug,
        'title', coalesce(nullif(j.title_zh, ''), j.title_en), 'field', s.field, 'soft', false)
      from public.asset_publications p
      cross join public.projects j
      cross join lateral (values ('cover_url', j.cover_url), ('architecture_url', j.architecture_url),
        ('body', concat_ws(' ', j.problem_zh, j.problem_en, j.solution_zh, j.solution_en, j.outcome_zh, j.outcome_en,
          j.contribution_zh, j.contribution_en, j.body_zh, j.body_en))) as s(field, text)
      where p.asset_id = p_asset and p.owner_id = p_actor and p.status = 'complete' and p.public_url <> ''
        and case when s.field = 'body' then position(p.public_url in s.text) > 0 else s.text = p.public_url end
    union all
    select jsonb_build_object('publication_id', p.id, 'url', p.public_url, 'kind', 'project_media', 'id', j.id, 'slug', j.slug,
        'title', coalesce(nullif(j.title_zh, ''), j.title_en), 'field', 'media', 'soft', false)
      from public.asset_publications p
      join public.project_media m on m.url = p.public_url
      join public.projects j on j.id = m.project_id
      where p.asset_id = p_asset and p.owner_id = p_actor and p.status = 'complete' and p.public_url <> ''
    union all
    select jsonb_build_object('publication_id', p.id, 'url', p.public_url, 'kind', 'post', 'id', t.id, 'slug', t.slug,
        'title', coalesce(nullif(t.title_zh, ''), t.title_en), 'field', s.field, 'soft', false)
      from public.asset_publications p
      cross join public.posts t
      cross join lateral (values ('cover_url', t.cover_url), ('body', concat_ws(' ', t.excerpt_zh, t.excerpt_en, t.body_zh, t.body_en))) as s(field, text)
      where p.asset_id = p_asset and p.owner_id = p_actor and p.status = 'complete' and p.public_url <> ''
        and case when s.field = 'body' then position(p.public_url in s.text) > 0 else s.text = p.public_url end
    union all
    -- One row per article, not per revision: the point is "an older version still needs this file".
    select jsonb_build_object('publication_id', p.id, 'url', p.public_url, 'kind', 'post_revision', 'id', t.id, 'slug', t.slug,
        'title', coalesce(nullif(t.title_zh, ''), t.title_en), 'field', 'revision', 'soft', true) as r
      from public.asset_publications p
      join public.posts t on true
      where p.asset_id = p_asset and p.owner_id = p_actor and p.status = 'complete' and p.public_url <> ''
        and exists(select 1 from public.post_revisions v where v.post_id = t.id and position(p.public_url in v.snapshot::text) > 0)
  ) x;
  return result;
end; $$;

-- Trash and revoke follow live references only; a soft revision reference is a warning in the UI.
create or replace function public.asset_change(p_actor uuid, p_asset uuid, p_action text, p_value text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.assets; v public.asset_versions;
begin
  select * into a from public.assets where id = p_asset and owner_id = p_actor for update;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  if p_action = 'restore' then
    if a.deleted_at is null then return to_jsonb(a); end if;
    update public.assets set deleted_at = null,updated_at = now() where id = a.id returning * into a;
  elsif p_action = 'trash' then
    if a.deleted_at is not null then return to_jsonb(a); end if;
    if exists(select 1 from jsonb_array_elements(public.asset_references(p_actor, a.id)) r where not (r->>'soft')::boolean) then raise exception 'ASSET_REFERENCED'; end if;
    if exists(select 1 from public.asset_versions where asset_id = a.id and status = 'pending') then raise exception 'UPLOAD_PENDING'; end if;
    update public.assets set deleted_at = now(),updated_at = now() where id = a.id returning * into a;
  elsif a.deleted_at is not null then raise exception 'ASSET_TRASHED';
  elsif p_action = 'cancel' then
    select * into v from public.asset_versions where id::text = p_value and asset_id = a.id for update;
    if not found then raise exception 'ASSET_NOT_FOUND'; end if;
    if v.status <> 'pending' then raise exception 'UPLOAD_REJECTED'; end if;
    update public.asset_versions set status = 'rejected', last_error = 'CANCELED' where id = v.id;
  elsif p_action = 'rename' then
    if p_value is null or length(trim(p_value)) not between 1 and 240 then raise exception 'INVALID_NAME'; end if;
    update public.assets set name = trim(p_value),updated_at = now() where id = a.id returning * into a;
  elsif p_action = 'version' then
    select * into v from public.asset_versions where id::text = p_value and asset_id = a.id and status = 'ready';
    if not found then raise exception 'VERSION_NOT_READY'; end if;
    update public.assets set current_version_id = v.id,updated_at = now() where id = a.id returning * into a;
  else raise exception 'INVALID_ACTION'; end if;
  insert into public.asset_events(actor_id,asset_id,version_id,action,detail)
    values(p_actor,a.id,v.id,'asset.' || p_action,jsonb_build_object('value',p_value));
  return to_jsonb(a);
end; $$;

create or replace function public.asset_revoke_publication(p_actor uuid, p_publication uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.asset_publications; used integer;
begin
  select * into p from public.asset_publications where id = p_publication and owner_id = p_actor;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  perform 1 from public.assets where id = p.asset_id for update;
  select * into p from public.asset_publications where id = p_publication for update;
  if p.status = 'revoked' then return to_jsonb(p); end if;
  if p.status = 'pending' then raise exception 'PUBLICATION_PENDING'; end if;
  select count(*) into used from jsonb_array_elements(public.asset_references(p_actor, p.asset_id)) r
    where r->>'publication_id' = p.id::text and not (r->>'soft')::boolean;
  if used > 0 then raise exception 'ASSET_REFERENCED'; end if;
  update public.asset_publications set status = 'revoked', revoked_at = now(), last_error = null where id = p.id returning * into p;
  insert into public.asset_events(actor_id,asset_id,version_id,action,detail)
    values(p_actor,p.asset_id,p.version_id,'publish.revoked',jsonb_build_object('operation',p.id,'slot',p.slot,'url',p.public_url));
  return to_jsonb(p);
end; $$;

revoke all on function public.post_save_revision(uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.post_save_revision(uuid,uuid,jsonb,text) to service_role;
commit;
