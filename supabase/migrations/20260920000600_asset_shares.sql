-- Time-limited share links for one private version: a recruiter can open a resume without an
-- account, the link stops working on its own, and it can be revoked at any time. Additive.
begin;

create table if not exists public.asset_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  asset_id uuid not null references public.assets(id) on delete cascade,
  version_id uuid not null references public.asset_versions(id),
  -- Only the SHA-256 of the token is stored. Losing this table cannot leak a working link, and the
  -- server cannot reconstruct one either: the plaintext exists once, in the reply that created it.
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  label text check (label is null or length(label) between 1 and 120),
  expires_at timestamptz not null,
  -- null means "no cap"; opens counts page loads that handed out a download, not completed reads.
  max_opens integer check (max_opens is null or max_opens between 1 and 10000),
  opens integer not null default 0,
  revoked_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists asset_shares_asset_idx on public.asset_shares(asset_id, created_at desc);

alter table public.asset_shares enable row level security;
revoke all on public.asset_shares from anon, authenticated;
grant all on public.asset_shares to service_role;

create or replace function public.asset_create_share(
  p_actor uuid, p_version uuid, p_hash text, p_expires timestamptz, p_max_opens integer default null, p_label text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.asset_versions; a public.assets; s public.asset_shares;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_REQUEST'; end if;
  -- An hour is the shortest useful window; a month is as long as an unattended link should live.
  if p_expires is null or p_expires <= now() + interval '1 minute' or p_expires > now() + interval '30 days' then raise exception 'INVALID_EXPIRY'; end if;
  select * into v from public.asset_versions where id = p_version and owner_id = p_actor;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  if v.status <> 'ready' then raise exception 'VERSION_NOT_READY'; end if;
  select * into a from public.assets where id = v.asset_id for update;
  if a.deleted_at is not null then raise exception 'ASSET_TRASHED'; end if;
  if (select count(*) from public.asset_shares where asset_id = a.id and revoked_at is null and expires_at > now()) >= 20 then raise exception 'SHARE_LIMIT'; end if;
  insert into public.asset_shares(owner_id, asset_id, version_id, token_hash, label, expires_at, max_opens)
    values(p_actor, a.id, v.id, p_hash, nullif(trim(coalesce(p_label, '')), ''), p_expires, p_max_opens)
    returning * into s;
  insert into public.asset_events(actor_id, asset_id, version_id, action, detail)
    values(p_actor, a.id, v.id, 'share.created', jsonb_build_object('share', s.id, 'expires_at', s.expires_at, 'max_opens', s.max_opens));
  return to_jsonb(s);
end; $$;

-- Read-only lookup for the landing page: says what is on offer without spending an open.
create or replace function public.asset_peek_share(p_hash text) returns jsonb
language plpgsql security definer set search_path = '' stable as $$
declare s public.asset_shares; v public.asset_versions; a public.assets;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('state', 'missing'); end if;
  select * into s from public.asset_shares where token_hash = p_hash;
  if not found then return jsonb_build_object('state', 'missing'); end if;
  select * into v from public.asset_versions where id = s.version_id;
  select * into a from public.assets where id = s.asset_id;
  return jsonb_build_object(
    'state', case
      when s.revoked_at is not null then 'revoked'
      when s.expires_at <= now() then 'expired'
      when s.max_opens is not null and s.opens >= s.max_opens then 'exhausted'
      when a.deleted_at is not null then 'revoked'
      else 'active' end,
    'name', a.name, 'mime_type', v.mime_type, 'size_bytes', v.size_bytes,
    'expires_at', s.expires_at, 'opens', s.opens, 'max_opens', s.max_opens, 'label', s.label);
end; $$;

-- Spends one open and returns the object to hand out. The counter is incremented in the same
-- statement that re-checks the cap, so two simultaneous opens cannot both pass the last slot.
create or replace function public.asset_redeem_share(p_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.asset_shares; v public.asset_versions; a public.assets;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'SHARE_NOT_AVAILABLE'; end if;
  update public.asset_shares set opens = opens + 1, last_opened_at = now()
    where token_hash = p_hash and revoked_at is null and expires_at > now()
      and (max_opens is null or opens < max_opens)
    returning * into s;
  if not found then raise exception 'SHARE_NOT_AVAILABLE'; end if;
  select * into a from public.assets where id = s.asset_id;
  if a.deleted_at is not null then raise exception 'SHARE_NOT_AVAILABLE'; end if;
  select * into v from public.asset_versions where id = s.version_id;
  if v.status <> 'ready' then raise exception 'SHARE_NOT_AVAILABLE'; end if;
  return jsonb_build_object('object_path', v.object_path, 'name', a.name, 'mime_type', v.mime_type, 'opens', s.opens);
end; $$;

create or replace function public.asset_revoke_share(p_actor uuid, p_share uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.asset_shares;
begin
  select * into s from public.asset_shares where id = p_share and owner_id = p_actor for update;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  if s.revoked_at is not null then return to_jsonb(s); end if;
  update public.asset_shares set revoked_at = now() where id = s.id returning * into s;
  insert into public.asset_events(actor_id, asset_id, version_id, action, detail)
    values(p_actor, s.asset_id, s.version_id, 'share.revoked', jsonb_build_object('share', s.id, 'opens', s.opens));
  return to_jsonb(s);
end; $$;

revoke all on function public.asset_create_share(uuid,uuid,text,timestamptz,integer,text) from public, anon, authenticated;
revoke all on function public.asset_peek_share(text) from public, anon, authenticated;
revoke all on function public.asset_redeem_share(text) from public, anon, authenticated;
revoke all on function public.asset_revoke_share(uuid,uuid) from public, anon, authenticated;
grant execute on function public.asset_create_share(uuid,uuid,text,timestamptz,integer,text),
  public.asset_peek_share(text), public.asset_redeem_share(text), public.asset_revoke_share(uuid,uuid) to service_role;
commit;
