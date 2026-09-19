-- Revoking a public copy: the publication is marked first (so nothing lists or picks it any more),
-- the server then removes the public object and records the purge. Additive.
begin;

alter table public.asset_publications add column if not exists revoked_at timestamptz;
alter table public.asset_publications add column if not exists purged_at timestamptz;
alter table public.asset_publications drop constraint if exists asset_publications_status_check;
alter table public.asset_publications add constraint asset_publications_status_check
  check (status in ('pending','complete','conflict','revoked'));

-- Refuses while the copy is still referenced by the profile, a project, a gallery row or an article.
-- Idempotent: revoking an already revoked publication returns it without a second event.
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
    where r->>'publication_id' = p.id::text;
  if used > 0 then raise exception 'ASSET_REFERENCED'; end if;
  update public.asset_publications set status = 'revoked', revoked_at = now(), last_error = null where id = p.id returning * into p;
  insert into public.asset_events(actor_id,asset_id,version_id,action,detail)
    values(p_actor,p.asset_id,p.version_id,'publish.revoked',jsonb_build_object('operation',p.id,'slot',p.slot,'url',p.public_url));
  return to_jsonb(p);
end; $$;

-- Called once Storage confirmed the public object is gone.
create or replace function public.asset_publication_purged(p_actor uuid, p_publication uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.asset_publications;
begin
  select * into p from public.asset_publications where id = p_publication and owner_id = p_actor for update;
  if not found then raise exception 'ASSET_NOT_FOUND'; end if;
  if p.status <> 'revoked' then raise exception 'INVALID_ACTION'; end if;
  if p.purged_at is not null then return to_jsonb(p); end if;
  update public.asset_publications set purged_at = now(), last_error = null where id = p.id returning * into p;
  insert into public.asset_events(actor_id,asset_id,version_id,action,detail)
    values(p_actor,p.asset_id,p.version_id,'publish.purged',jsonb_build_object('operation',p.id,'slot',p.slot));
  return to_jsonb(p);
end; $$;

revoke all on function public.asset_revoke_publication(uuid,uuid) from public, anon, authenticated;
revoke all on function public.asset_publication_purged(uuid,uuid) from public, anon, authenticated;
grant execute on function public.asset_revoke_publication(uuid,uuid), public.asset_publication_purged(uuid,uuid) to service_role;
commit;
