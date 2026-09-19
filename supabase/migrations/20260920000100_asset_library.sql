-- Private originals, immutable versions, recoverable deletion and publication history.
-- Additive migration: existing public objects and content URLs are left intact.
begin;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check (length(name) between 1 and 240),
  current_version_id uuid,
  version_count integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id),
  owner_id uuid not null references auth.users(id),
  request_id uuid not null,
  version_no integer not null,
  original_name text not null,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','image/gif','application/pdf')),
  size_bytes bigint not null check (size_bytes between 1 and 8388608),
  sha256 text check (sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','ready','rejected')),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(owner_id, request_id),
  unique(asset_id, version_no),
  unique(asset_id, id)
);

alter table public.assets drop constraint if exists assets_current_version_fkey;
alter table public.assets add constraint assets_current_version_fkey
  foreign key (id, current_version_id) references public.asset_versions(asset_id, id);

create table if not exists public.asset_publications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  asset_id uuid not null references public.assets(id),
  version_id uuid not null references public.asset_versions(id),
  request_id uuid not null,
  slot text not null check (slot in ('public','avatar','resume_zh','resume_en')),
  bucket text not null check (bucket in ('media','resume')),
  object_path text not null unique,
  expected_url text,
  public_url text,
  content_sha256 text check (content_sha256 ~ '^[a-f0-9]{64}$'),
  content_type text,
  content_size bigint check (content_size between 1 and 8388608),
  status text not null default 'pending' check (status in ('pending','complete','conflict')),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(owner_id, request_id)
);

create table if not exists public.asset_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  asset_id uuid not null references public.assets(id),
  version_id uuid references public.asset_versions(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assets_owner_updated_idx on public.assets(owner_id, updated_at desc, id);
create index if not exists asset_events_asset_idx on public.asset_events(asset_id, id desc);
create index if not exists asset_events_actor_idx on public.asset_events(actor_id, id desc);
create index if not exists asset_publications_asset_idx on public.asset_publications(asset_id);

alter table public.assets enable row level security;
alter table public.asset_versions enable row level security;
alter table public.asset_publications enable row level security;
alter table public.asset_events enable row level security;
revoke all on public.assets, public.asset_versions, public.asset_publications, public.asset_events from anon, authenticated;
grant all on public.assets, public.asset_versions, public.asset_publications, public.asset_events to service_role;
grant usage, select on sequence public.asset_events_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets-private','assets-private',false,8388608,
  array['image/png','image/jpeg','image/webp','image/gif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Include legacy objects, retained versions and pending reservations across all buckets.
create or replace function public.asset_library_usage() returns bigint
language sql security definer set search_path = '' as $$
  select coalesce((select sum(coalesce((metadata->>'size')::bigint,0)) from storage.objects),0)
    + coalesce((select sum(greatest(8388608 - coalesce((o.metadata->>'size')::bigint,0),0))
        from public.asset_versions v left join storage.objects o
          on o.bucket_id = 'assets-private' and o.name = v.object_path
        where v.status <> 'ready'),0)
    + coalesce((select sum(greatest(8388608 - coalesce((o.metadata->>'size')::bigint,0),0))
        from public.asset_publications p join public.asset_versions v on v.id = p.version_id
        left join storage.objects o on o.bucket_id = p.bucket and o.name = p.object_path
        where p.status = 'pending'),0);
$$;

create or replace function public.asset_begin_upload(
  p_actor uuid, p_request uuid, p_name text, p_mime text, p_size bigint, p_asset uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.assets; v public.asset_versions; ext text;
begin
  perform pg_advisory_xact_lock(20260920, 1);
  if p_actor is null or p_request is null or p_name is null or length(trim(p_name)) not between 1 and 240
    or p_size is null or p_size not between 1 and 8388608 then raise exception 'INVALID_UPLOAD'; end if;
  ext := case p_mime when 'image/png' then 'png' when 'image/jpeg' then 'jpg'
    when 'image/webp' then 'webp' when 'image/gif' then 'gif' when 'application/pdf' then 'pdf' end;
  if ext is null then raise exception 'INVALID_TYPE'; end if;
  select * into v from public.asset_versions where owner_id = p_actor and request_id = p_request;
  if found then
    if v.original_name <> p_name or v.mime_type <> p_mime or v.size_bytes <> p_size
      or (p_asset is not null and v.asset_id <> p_asset) then raise exception 'REQUEST_CONFLICT'; end if;
    if exists(select 1 from public.assets where id = v.asset_id and deleted_at is not null) then raise exception 'ASSET_TRASHED'; end if;
    return to_jsonb(v);
  end if;
  if public.asset_library_usage() + 8388608 > 800000000 then raise exception 'QUOTA_EXCEEDED'; end if;
  if p_asset is null then
    insert into public.assets(owner_id,name) values(p_actor,p_name) returning * into a;
  else
    select * into a from public.assets where id = p_asset and owner_id = p_actor for update;
    if not found then raise exception 'ASSET_NOT_FOUND'; end if;
    if a.deleted_at is not null then raise exception 'ASSET_TRASHED'; end if;
  end if;
  if exists(select 1 from public.asset_versions where asset_id = a.id and status = 'pending') then raise exception 'UPLOAD_PENDING'; end if;
  v.id := gen_random_uuid();
  insert into public.asset_versions(id,asset_id,owner_id,request_id,version_no,original_name,object_path,mime_type,size_bytes)
    values(v.id,a.id,p_actor,p_request,a.version_count+1,p_name,
      p_actor::text || '/' || a.id::text || '/' || v.id::text || '.' || ext,p_mime,p_size) returning * into v;
  update public.assets set version_count = v.version_no, updated_at = now() where id = a.id;
  insert into public.asset_events(actor_id,asset_id,version_id,action) values(p_actor,a.id,v.id,'upload.started');
  return to_jsonb(v);
end; $$;

create or replace function public.asset_finish_upload(p_actor uuid, p_version uuid, p_size bigint, p_mime text, p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.asset_versions; a public.assets;
begin
  select * into v from public.asset_versions where id = p_version and owner_id = p_actor;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  select * into a from public.assets where id = v.asset_id for update;
  select * into v from public.asset_versions where id = p_version for update;
  if a.deleted_at is not null then raise exception 'ASSET_TRASHED'; end if;
  if v.status = 'ready' then return to_jsonb(v); end if;
  if v.status <> 'pending' then raise exception 'UPLOAD_REJECTED'; end if;
  if p_size is null or p_mime is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$'
    or p_size <> v.size_bytes or p_mime <> v.mime_type then raise exception 'UPLOAD_MISMATCH'; end if;
  update public.asset_versions set status = 'ready', sha256 = p_hash, completed_at = now(), last_error = null
    where id = v.id returning * into v;
  update public.assets set current_version_id = v.id, updated_at = now() where id = a.id;
  insert into public.asset_events(actor_id,asset_id,version_id,action) values(p_actor,a.id,v.id,'upload.verified');
  return to_jsonb(v);
end; $$;

create or replace function public.asset_upload_error(p_actor uuid, p_version uuid, p_error text, p_reject boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.asset_versions;
begin
  select * into v from public.asset_versions where id = p_version and owner_id = p_actor for update;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  if v.status <> 'pending' then return; end if;
  if v.last_error is distinct from left(p_error,160) or p_reject then
    update public.asset_versions set last_error = left(p_error,160), status = case when p_reject then 'rejected' else 'pending' end where id = v.id;
    insert into public.asset_events(actor_id,asset_id,version_id,action,detail)
      values(p_actor,v.asset_id,v.id,case when p_reject then 'upload.rejected' else 'upload.retry_needed' end,jsonb_build_object('reason',left(p_error,160)));
  end if;
end; $$;

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
    -- Published URLs may be embedded in legacy Markdown. Retain them conservatively.
    if exists(select 1 from public.asset_publications where asset_id = a.id) then raise exception 'ASSET_PUBLISHED'; end if;
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

create or replace function public.asset_prepare_publish(p_actor uuid, p_version uuid, p_slot text, p_request uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.asset_versions; a public.assets; p public.asset_publications; previous text; b text;
begin
  perform pg_advisory_xact_lock(20260920, 1);
  if p_request is null or p_slot is null or p_slot not in ('public','avatar','resume_zh','resume_en') then raise exception 'INVALID_SLOT'; end if;
  select * into p from public.asset_publications where owner_id = p_actor and request_id = p_request;
  if found then
    if p.version_id <> p_version or p.slot <> p_slot then raise exception 'REQUEST_CONFLICT'; end if;
    return to_jsonb(p);
  end if;
  select * into v from public.asset_versions where id = p_version and owner_id = p_actor;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  select * into a from public.assets where id = v.asset_id for update;
  if a.deleted_at is not null then raise exception 'ASSET_TRASHED'; end if;
  if v.status <> 'ready' then raise exception 'VERSION_NOT_READY'; end if;
  if (p_slot = 'avatar' and v.mime_type = 'application/pdf') or (p_slot like 'resume_%' and v.mime_type <> 'application/pdf') then raise exception 'INVALID_TYPE'; end if;
  if public.asset_library_usage() + 8388608 > 800000000 then raise exception 'QUOTA_EXCEEDED'; end if;
  if p_slot <> 'public' then
    select case p_slot when 'avatar' then avatar_url when 'resume_zh' then resume_zh_url else resume_en_url end
      into previous from public.profile where id = 1;
    if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  end if;
  p.id := gen_random_uuid();
  b := case when v.mime_type = 'application/pdf' then 'resume' else 'media' end;
  insert into public.asset_publications(id,owner_id,asset_id,version_id,request_id,slot,bucket,object_path,expected_url)
    values(p.id,p_actor,a.id,v.id,p_request,p_slot,b,'library/' || a.id::text || '/' || p.id::text,previous)
    returning * into p;
  insert into public.asset_events(actor_id,asset_id,version_id,action,detail)
    values(p_actor,a.id,v.id,'publish.started',jsonb_build_object('operation',p.id,'slot',p_slot));
  return to_jsonb(p);
end; $$;

-- Freeze the public representation separately from the original (e.g. optimized WebP).
create or replace function public.asset_publication_payload(p_actor uuid, p_operation uuid, p_hash text, p_mime text, p_size bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.asset_publications;
begin
  select * into p from public.asset_publications where id = p_operation and owner_id = p_actor for update;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_size is null or p_size not between 1 and 8388608
    or p_mime is null or (p.bucket = 'resume' and p_mime <> 'application/pdf')
    or (p.bucket = 'media' and p_mime not in ('image/png','image/jpeg','image/webp','image/gif')) then raise exception 'UPLOAD_MISMATCH'; end if;
  if p.content_sha256 is not null then
    if p.content_sha256 <> p_hash or p.content_type <> p_mime or p.content_size <> p_size then raise exception 'REQUEST_CONFLICT'; end if;
    return to_jsonb(p);
  end if;
  update public.asset_publications set content_sha256 = p_hash, content_type = p_mime, content_size = p_size where id = p.id returning * into p;
  return to_jsonb(p);
end; $$;

create or replace function public.asset_finish_publish(p_actor uuid, p_operation uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.asset_publications; previous text;
begin
  select * into p from public.asset_publications where id = p_operation and owner_id = p_actor;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  perform 1 from public.assets where id = p.asset_id for update;
  select * into p from public.asset_publications where id = p_operation for update;
  if p.status <> 'pending' then return to_jsonb(p); end if;
  if p.content_sha256 is null then raise exception 'VERSION_NOT_READY'; end if;
  if p_url is null or position('/storage/v1/object/public/' || p.bucket || '/' || p.object_path in p_url) = 0 then raise exception 'INVALID_URL'; end if;
  if p.slot <> 'public' then
    select case p.slot when 'avatar' then avatar_url when 'resume_zh' then resume_zh_url else resume_en_url end
      into previous from public.profile where id = 1 for update;
    if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
    if previous is distinct from p.expected_url then
      update public.asset_publications set status = 'conflict', public_url = p_url, last_error = 'PROFILE_CHANGED' where id = p.id returning * into p;
      insert into public.asset_events(actor_id,asset_id,version_id,action,detail)
        values(p_actor,p.asset_id,p.version_id,'publish.conflict',jsonb_build_object('operation',p.id));
      return to_jsonb(p);
    end if;
    update public.profile set
      avatar_url = case when p.slot = 'avatar' then p_url else avatar_url end,
      resume_zh_url = case when p.slot = 'resume_zh' then p_url else resume_zh_url end,
      resume_en_url = case when p.slot = 'resume_en' then p_url else resume_en_url end,
      resume_updated_at = case when p.slot like 'resume_%' then now() else resume_updated_at end,
      updated_at = now() where id = 1;
  end if;
  update public.asset_publications set status = 'complete', public_url = p_url, completed_at = now(),last_error = null where id = p.id returning * into p;
  insert into public.asset_events(actor_id,asset_id,version_id,action,detail)
    values(p_actor,p.asset_id,p.version_id,'publish.complete',jsonb_build_object('operation',p.id,'slot',p.slot,'previous_url',p.expected_url));
  return to_jsonb(p);
end; $$;

revoke all on function public.asset_library_usage() from public, anon, authenticated;
revoke all on function public.asset_begin_upload(uuid,uuid,text,text,bigint,uuid) from public, anon, authenticated;
revoke all on function public.asset_finish_upload(uuid,uuid,bigint,text,text) from public, anon, authenticated;
revoke all on function public.asset_upload_error(uuid,uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.asset_change(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.asset_prepare_publish(uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.asset_finish_publish(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.asset_publication_payload(uuid,uuid,text,text,bigint) from public, anon, authenticated;
grant execute on function public.asset_library_usage(), public.asset_begin_upload(uuid,uuid,text,text,bigint,uuid),
  public.asset_finish_upload(uuid,uuid,bigint,text,text), public.asset_upload_error(uuid,uuid,text,boolean),
  public.asset_change(uuid,uuid,text,text), public.asset_prepare_publish(uuid,uuid,text,uuid),
  public.asset_finish_publish(uuid,uuid,text), public.asset_publication_payload(uuid,uuid,text,text,bigint) to service_role;
commit;
