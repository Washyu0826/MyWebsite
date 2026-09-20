\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_database() <> 'asset_library_test' then raise exception 'TEST_DATABASE_REQUIRED'; end if;
end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'Expected %, but operation succeeded', expected;
exception when others then
  if sqlerrm <> expected then raise exception 'Expected %, got %', expected, sqlerrm; end if;
end $$;

do $$
declare
  actor uuid := '44444444-4444-4444-8444-444444444444';
  other uuid := '55555555-5555-4555-8555-555555555555';
  asset uuid; version uuid; pending uuid;
  hash text := repeat('a',64); capped text := repeat('b',64); gone text := repeat('c',64);
  s jsonb; peek jsonb; n integer;
begin
  insert into auth.users values(actor),(other) on conflict do nothing;
  insert into public.assets(owner_id,name) values(actor,'resume.pdf') returning id into asset;
  insert into public.asset_versions(asset_id,owner_id,request_id,version_no,original_name,object_path,mime_type,size_bytes,status,sha256)
    values(asset,actor,gen_random_uuid(),1,'resume.pdf',actor::text || '/' || asset::text || '/v1.pdf','application/pdf',1000,'ready',repeat('d',64))
    returning id into version;
  insert into public.asset_versions(asset_id,owner_id,request_id,version_no,original_name,object_path,mime_type,size_bytes)
    values(asset,actor,gen_random_uuid(),2,'resume.pdf',actor::text || '/' || asset::text || '/v2.pdf','application/pdf',1000)
    returning id into pending;

  assert not has_table_privilege('anon','public.asset_shares','SELECT');
  assert not has_table_privilege('authenticated','public.asset_shares','SELECT');
  assert not has_function_privilege('anon','public.asset_redeem_share(text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.asset_create_share(uuid,uuid,text,timestamptz,integer,text)','EXECUTE');
  assert (select relrowsecurity from pg_class where relname = 'asset_shares');

  -- Input guards: a token must be a SHA-256, the window must be real and bounded.
  perform pg_temp.expect_error(format('select public.asset_create_share(%L,%L,%L,%L)',actor,version,'nope',now() + interval '1 day'),'INVALID_REQUEST');
  perform pg_temp.expect_error(format('select public.asset_create_share(%L,%L,%L,%L)',actor,version,hash,now() - interval '1 hour'),'INVALID_EXPIRY');
  perform pg_temp.expect_error(format('select public.asset_create_share(%L,%L,%L,%L)',actor,version,hash,now() + interval '60 days'),'INVALID_EXPIRY');
  perform pg_temp.expect_error(format('select public.asset_create_share(%L,%L,%L,%L)',actor,pending,hash,now() + interval '1 day'),'VERSION_NOT_READY');
  perform pg_temp.expect_error(format('select public.asset_create_share(%L,%L,%L,%L)',other,version,hash,now() + interval '1 day'),'ASSET_NOT_FOUND');

  s := public.asset_create_share(actor,version,hash,now() + interval '7 days',null,'  面試用  ');
  assert s->>'label' = '面試用', 'the label is trimmed';
  assert (s->>'opens')::integer = 0 and s->>'revoked_at' is null;
  assert exists(select 1 from public.asset_events where action = 'share.created' and asset_id = asset);

  -- Peek describes the link without spending an open, and knows nothing about a token it lacks.
  peek := public.asset_peek_share(hash);
  assert peek->>'state' = 'active' and peek->>'name' = 'resume.pdf' and (peek->>'size_bytes')::bigint = 1000;
  assert (peek->>'opens')::integer = 0;
  assert public.asset_peek_share(repeat('f',64))->>'state' = 'missing';
  assert public.asset_peek_share('not-a-hash')->>'state' = 'missing';
  assert (select opens from public.asset_shares where token_hash = hash) = 0, 'peek must not spend an open';

  -- Redeeming hands back the private object and counts the open.
  assert public.asset_redeem_share(hash)->>'object_path' = (select object_path from public.asset_versions where id = version);
  assert (select opens from public.asset_shares where token_hash = hash) = 1;
  assert (select last_opened_at is not null from public.asset_shares where token_hash = hash);
  perform pg_temp.expect_error(format('select public.asset_redeem_share(%L)',repeat('f',64)),'SHARE_NOT_AVAILABLE');

  -- A cap is enforced by the same statement that increments, so the last slot cannot be used twice.
  s := public.asset_create_share(actor,version,capped,now() + interval '1 day',1,null);
  perform public.asset_redeem_share(capped);
  assert public.asset_peek_share(capped)->>'state' = 'exhausted';
  perform pg_temp.expect_error(format('select public.asset_redeem_share(%L)',capped),'SHARE_NOT_AVAILABLE');
  assert (select opens from public.asset_shares where token_hash = capped) = 1, 'a refused open is not counted';

  -- Revoking stops new opens and is idempotent; only the owner may do it.
  s := public.asset_create_share(actor,version,gone,now() + interval '1 day',null,'撤銷測試');
  perform pg_temp.expect_error(format('select public.asset_revoke_share(%L,%L)',other,s->>'id'),'ASSET_NOT_FOUND');
  s := public.asset_revoke_share(actor,(s->>'id')::uuid);
  assert s->>'revoked_at' is not null;
  select count(*) into n from public.asset_events;
  assert public.asset_revoke_share(actor,(s->>'id')::uuid)->>'revoked_at' = s->>'revoked_at';
  assert (select count(*) from public.asset_events) = n, 'revoking twice writes one event';
  assert public.asset_peek_share(gone)->>'state' = 'revoked';
  perform pg_temp.expect_error(format('select public.asset_redeem_share(%L)',gone),'SHARE_NOT_AVAILABLE');

  -- An expired link reads as expired and cannot be redeemed.
  update public.asset_shares set expires_at = now() - interval '1 minute' where token_hash = hash;
  assert public.asset_peek_share(hash)->>'state' = 'expired';
  perform pg_temp.expect_error(format('select public.asset_redeem_share(%L)',hash),'SHARE_NOT_AVAILABLE');

  -- Recycling the asset takes its links out of service without deleting the history.
  update public.asset_shares set expires_at = now() + interval '1 day', revoked_at = null where token_hash = hash;
  update public.assets set deleted_at = now() where id = asset;
  assert public.asset_peek_share(hash)->>'state' = 'revoked';
  perform pg_temp.expect_error(format('select public.asset_redeem_share(%L)',hash),'SHARE_NOT_AVAILABLE');
  perform pg_temp.expect_error(format('select public.asset_create_share(%L,%L,%L,%L)',actor,version,repeat('e',64),now() + interval '1 day'),'ASSET_TRASHED');
  update public.assets set deleted_at = null where id = asset;

  -- A per-asset ceiling keeps a runaway script from minting links forever.
  -- Two live links already exist (one of them exhausted, which still occupies a slot).
  for n in 1..18 loop
    perform public.asset_create_share(actor,version,md5(n::text) || md5((n + 100)::text),now() + interval '1 day',null,null);
  end loop;
  assert (select count(*) from public.asset_shares where asset_id = asset and revoked_at is null and expires_at > now()) = 20;
  perform pg_temp.expect_error(format('select public.asset_create_share(%L,%L,%L,%L)',actor,version,repeat('9',64),now() + interval '1 day'),'SHARE_LIMIT');

  raise notice 'PASS: share permissions, hashed tokens, expiry bounds, peek without spending, redeem counting, open caps, revoke, trashed assets, per-asset limit';
end $$;
rollback;
