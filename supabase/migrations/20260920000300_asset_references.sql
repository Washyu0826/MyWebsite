-- Where published assets are used, a trash rule that blocks only referenced assets, and capacity
-- reservations that lapse once a signed upload URL can no longer be used.
-- Additive: replaces two functions from 20260920000100_asset_library.sql and adds one; no table changes.
begin;

-- Every place the site stores a public URL: the profile slots, project visuals, gallery rows, article
-- covers and the Markdown bodies. One entry per (publication, location, field). Owner scoped.
create or replace function public.asset_references(p_actor uuid, p_asset uuid) returns jsonb
language plpgsql security definer set search_path = '' stable as $$
declare result jsonb;
begin
  select coalesce(jsonb_agg(r order by r->>'kind', r->>'title', r->>'field'), '[]'::jsonb) into result from (
    select jsonb_build_object('publication_id', p.id, 'url', p.public_url, 'kind', 'profile', 'id', null, 'slug', null, 'title', s.slot, 'field', s.slot) as r
      from public.asset_publications p
      cross join public.profile f
      cross join lateral (values ('avatar', f.avatar_url), ('resume_zh', f.resume_zh_url), ('resume_en', f.resume_en_url)) as s(slot, url)
      where p.asset_id = p_asset and p.owner_id = p_actor and p.status = 'complete' and p.public_url <> ''
        and f.id = 1 and s.url = p.public_url
    union all
    select jsonb_build_object('publication_id', p.id, 'url', p.public_url, 'kind', 'project', 'id', j.id, 'slug', j.slug,
        'title', coalesce(nullif(j.title_zh, ''), j.title_en), 'field', s.field)
      from public.asset_publications p
      cross join public.projects j
      cross join lateral (values ('cover_url', j.cover_url), ('architecture_url', j.architecture_url),
        ('body', concat_ws(' ', j.problem_zh, j.problem_en, j.solution_zh, j.solution_en, j.outcome_zh, j.outcome_en,
          j.contribution_zh, j.contribution_en, j.body_zh, j.body_en))) as s(field, text)
      where p.asset_id = p_asset and p.owner_id = p_actor and p.status = 'complete' and p.public_url <> ''
        and case when s.field = 'body' then position(p.public_url in s.text) > 0 else s.text = p.public_url end
    union all
    select jsonb_build_object('publication_id', p.id, 'url', p.public_url, 'kind', 'project_media', 'id', j.id, 'slug', j.slug,
        'title', coalesce(nullif(j.title_zh, ''), j.title_en), 'field', 'media')
      from public.asset_publications p
      join public.project_media m on m.url = p.public_url
      join public.projects j on j.id = m.project_id
      where p.asset_id = p_asset and p.owner_id = p_actor and p.status = 'complete' and p.public_url <> ''
    union all
    select jsonb_build_object('publication_id', p.id, 'url', p.public_url, 'kind', 'post', 'id', t.id, 'slug', t.slug,
        'title', coalesce(nullif(t.title_zh, ''), t.title_en), 'field', s.field)
      from public.asset_publications p
      cross join public.posts t
      cross join lateral (values ('cover_url', t.cover_url), ('body', concat_ws(' ', t.excerpt_zh, t.excerpt_en, t.body_zh, t.body_en))) as s(field, text)
      where p.asset_id = p_asset and p.owner_id = p_actor and p.status = 'complete' and p.public_url <> ''
        and case when s.field = 'body' then position(p.public_url in s.text) > 0 else s.text = p.public_url end
  ) x;
  return result;
end; $$;

-- Stored objects always count. A reservation for a signed-but-unfinished upload or publication only
-- counts while the signature could still be used (Supabase signs upload URLs for two hours); after a
-- day the reservation lapses on its own, so cancelled or abandoned uploads stop eating the budget.
create or replace function public.asset_library_usage() returns bigint
language sql security definer set search_path = '' as $$
  select coalesce((select sum(coalesce((metadata->>'size')::bigint,0)) from storage.objects),0)
    + coalesce((select sum(greatest(8388608 - coalesce((o.metadata->>'size')::bigint,0),0))
        from public.asset_versions v left join storage.objects o
          on o.bucket_id = 'assets-private' and o.name = v.object_path
        where v.status <> 'ready' and v.created_at > now() - interval '24 hours'),0)
    + coalesce((select sum(greatest(8388608 - coalesce((o.metadata->>'size')::bigint,0),0))
        from public.asset_publications p join public.asset_versions v on v.id = p.version_id
        left join storage.objects o on o.bucket_id = p.bucket and o.name = p.object_path
        where p.status = 'pending' and p.created_at > now() - interval '24 hours'),0);
$$;

-- Same as before except for the trash rule: an asset is protected while any of its public copies is
-- still used by the profile, a project, a gallery row or an article. Published-but-unreferenced
-- assets can be recycled; the public object is untouched either way, so nothing breaks.
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
    if jsonb_array_length(public.asset_references(p_actor, a.id)) > 0 then raise exception 'ASSET_REFERENCED'; end if;
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

revoke all on function public.asset_references(uuid,uuid) from public, anon, authenticated;
grant execute on function public.asset_references(uuid,uuid) to service_role;
commit;
