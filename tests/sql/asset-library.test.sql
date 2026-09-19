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
  actor uuid := '11111111-1111-4111-8111-111111111111';
  other uuid := '22222222-2222-4222-8222-222222222222';
  request uuid := gen_random_uuid();
  v jsonb; v2 jsonb; cancelled jsonb; p jsonb; p2 jsonb; n integer; url text;
begin
  insert into auth.users values(actor),(other);
  insert into public.profile(id,avatar_url) values(1,'https://example.com/original.jpg');
  assert not (select public from storage.buckets where id = 'assets-private'), 'originals must be private';
  assert (select count(*) from pg_class where relname in ('assets','asset_versions','asset_publications','asset_events') and relrowsecurity) = 4;
  assert not has_table_privilege('anon','public.assets','SELECT');
  assert not has_table_privilege('authenticated','public.asset_versions','SELECT');
  assert not has_function_privilege('authenticated','public.asset_begin_upload(uuid,uuid,text,text,bigint,uuid)','EXECUTE');
  assert not has_function_privilege('anon','public.asset_publication_payload(uuid,uuid,text,text,bigint)','EXECUTE');
  assert has_function_privilege('service_role','public.asset_change(uuid,uuid,text,text)','EXECUTE');

  v := public.asset_begin_upload(actor,request,'my portrait.jpg','image/jpeg',100);
  assert v->>'object_path' ~ '^[a-f0-9/-]+\.jpg$', 'key must be ASCII and opaque';
  assert public.asset_library_usage() = 8388608, 'signed upload reserves full bucket limit';
  assert public.asset_begin_upload(actor,request,'my portrait.jpg','image/jpeg',100)->>'id' = v->>'id';
  assert (select count(*) from public.asset_events) = 1, 'idempotent begin must not duplicate audit entries';
  perform pg_temp.expect_error(format('select public.asset_begin_upload(%L,%L,%L,%L,101)',actor,request,'my portrait.jpg','image/jpeg'),'REQUEST_CONFLICT');
  perform pg_temp.expect_error(format('select public.asset_begin_upload(%L,%L,%L,%L,100,%L)',actor,gen_random_uuid(),'v2.jpg','image/jpeg',v->>'asset_id'),'UPLOAD_PENDING');
  perform pg_temp.expect_error(format('select public.asset_change(%L,%L,%L)',other,v->>'asset_id','trash'),'ASSET_NOT_FOUND');
  perform pg_temp.expect_error(format('select public.asset_finish_upload(%L,%L,101,%L,%L)',actor,v->>'id','image/jpeg',repeat('a',64)),'UPLOAD_MISMATCH');
  perform pg_temp.expect_error(format('select public.asset_finish_upload(%L,%L,100,%L,%L)',other,v->>'id','image/jpeg',repeat('a',64)),'ASSET_NOT_FOUND');
  insert into storage.objects values('assets-private',v->>'object_path','{"size":100}');
  v := public.asset_finish_upload(actor,(v->>'id')::uuid,100,'image/jpeg',repeat('a',64));
  assert public.asset_library_usage() = 100;
  select count(*) into n from public.asset_events;
  perform public.asset_finish_upload(actor,(v->>'id')::uuid,100,'image/jpeg',repeat('a',64));
  assert (select count(*) from public.asset_events) = n;

  v2 := public.asset_begin_upload(actor,gen_random_uuid(),'v2.jpg','image/jpeg',150,(v->>'asset_id')::uuid);
  insert into storage.objects values('assets-private',v2->>'object_path','{"size":150}');
  v2 := public.asset_finish_upload(actor,(v2->>'id')::uuid,150,'image/jpeg',repeat('b',64));
  assert (v2->>'version_no')::integer = 2;
  perform public.asset_change(actor,(v->>'asset_id')::uuid,'version',v->>'id');
  assert (select current_version_id::text from public.assets where id = (v->>'asset_id')::uuid) = v->>'id';
  perform public.asset_change(actor,(v->>'asset_id')::uuid,'rename','New name');
  perform public.asset_change(actor,(v->>'asset_id')::uuid,'trash');
  select count(*) into n from public.asset_events;
  perform public.asset_change(actor,(v->>'asset_id')::uuid,'trash');
  assert (select count(*) from public.asset_events) = n, 'trash retries are idempotent';
  assert (select count(*) from public.asset_versions) = 2, 'trash keeps every version';
  perform pg_temp.expect_error(format('select public.asset_prepare_publish(%L,%L,%L,%L)',actor,v->>'id','avatar',gen_random_uuid()),'ASSET_TRASHED');
  perform public.asset_change(actor,(v->>'asset_id')::uuid,'restore');
  assert (select deleted_at is null from public.assets where id = (v->>'asset_id')::uuid);

  cancelled := public.asset_begin_upload(actor,gen_random_uuid(),'v3.jpg','image/jpeg',100,(v->>'asset_id')::uuid);
  perform public.asset_change(actor,(v->>'asset_id')::uuid,'cancel',cancelled->>'id');
  perform pg_temp.expect_error(format('select public.asset_finish_upload(%L,%L,100,%L,%L)',actor,cancelled->>'id','image/jpeg',repeat('a',64)),'UPLOAD_REJECTED');
  assert public.asset_library_usage() = 8388858, 'canceled token capacity remains reserved';
  update public.asset_versions set created_at = now() - interval '2 days' where id = (cancelled->>'id')::uuid;
  assert public.asset_library_usage() = 250, 'reservation lapses once the signed upload URL has expired';

  request := gen_random_uuid();
  p := public.asset_prepare_publish(actor,(v->>'id')::uuid,'avatar',request);
  assert public.asset_prepare_publish(actor,(v->>'id')::uuid,'avatar',request)->>'id' = p->>'id';
  p2 := public.asset_prepare_publish(actor,(v2->>'id')::uuid,'avatar',gen_random_uuid());
  perform public.asset_publication_payload(actor,(p->>'id')::uuid,repeat('c',64),'image/webp',80);
  perform public.asset_publication_payload(actor,(p2->>'id')::uuid,repeat('d',64),'image/webp',90);
  perform pg_temp.expect_error(format('select public.asset_publication_payload(%L,%L,%L,%L,80)',actor,p->>'id',repeat('f',64),'image/webp'),'REQUEST_CONFLICT');
  url := 'https://example.supabase.co/storage/v1/object/public/media/' || (p->>'object_path');
  p := public.asset_finish_publish(actor,(p->>'id')::uuid,url);
  assert p->>'status' = 'complete';
  assert (select avatar_url from public.profile where id = 1) = url;
  p2 := public.asset_finish_publish(actor,(p2->>'id')::uuid,'https://example.supabase.co/storage/v1/object/public/media/' || (p2->>'object_path'));
  assert p2->>'status' = 'conflict', 'stale publication must not overwrite another publish';
  assert (select avatar_url from public.profile where id = 1) = url;
  select count(*) into n from public.asset_events;
  perform public.asset_finish_publish(actor,(p->>'id')::uuid,url);
  assert (select count(*) from public.asset_events) = n;
  assert exists(select 1 from public.asset_events where detail->>'previous_url' = 'https://example.com/original.jpg');
  assert public.asset_references(actor,(v->>'asset_id')::uuid)->0->>'kind' = 'profile', 'avatar slot is a reference';
  perform pg_temp.expect_error(format('select public.asset_change(%L,%L,%L)',actor,v->>'asset_id','trash'),'ASSET_REFERENCED');
  insert into public.posts(slug,title_zh,body_zh) values('notes','筆記','![](' || url || ')');
  insert into public.projects(slug,title_zh,cover_url) values('demo','Demo',url);
  insert into public.project_media(project_id,url) select id,url from public.projects where slug = 'demo';
  assert jsonb_array_length(public.asset_references(actor,(v->>'asset_id')::uuid)) = 4, 'profile, post body, project cover and gallery row';
  assert public.asset_references(other,(v->>'asset_id')::uuid) = '[]'::jsonb, 'references are owner scoped';
  update public.profile set avatar_url = 'https://example.com/replaced.jpg' where id = 1;
  delete from public.project_media; delete from public.projects; delete from public.posts;
  assert public.asset_references(actor,(v->>'asset_id')::uuid) = '[]'::jsonb;
  perform public.asset_change(actor,(v->>'asset_id')::uuid,'trash');
  assert (select deleted_at is not null from public.assets where id = (v->>'asset_id')::uuid), 'published but unreferenced assets can be recycled';
  assert exists(select 1 from storage.objects where bucket_id = 'assets-private' and name = v->>'object_path'), 'trash never touches objects';
  perform public.asset_change(actor,(v->>'asset_id')::uuid,'restore');
  -- Revoking a public copy: blocked while referenced, owner scoped, idempotent, then purged.
  update public.profile set avatar_url = url where id = 1;
  perform pg_temp.expect_error(format('select public.asset_revoke_publication(%L,%L)',actor,p->>'id'),'ASSET_REFERENCED');
  update public.profile set avatar_url = 'https://example.com/replaced.jpg' where id = 1;
  perform pg_temp.expect_error(format('select public.asset_revoke_publication(%L,%L)',other,p->>'id'),'ASSET_NOT_FOUND');
  perform pg_temp.expect_error(format('select public.asset_publication_purged(%L,%L)',actor,p->>'id'),'INVALID_ACTION');
  p := public.asset_revoke_publication(actor,(p->>'id')::uuid);
  assert p->>'status' = 'revoked' and p->>'revoked_at' is not null and p->>'purged_at' is null;
  select count(*) into n from public.asset_events;
  assert public.asset_revoke_publication(actor,(p->>'id')::uuid)->>'status' = 'revoked';
  assert (select count(*) from public.asset_events) = n, 'revoke retries are idempotent';
  p := public.asset_publication_purged(actor,(p->>'id')::uuid);
  assert p->>'purged_at' is not null;
  assert public.asset_publication_purged(actor,(p->>'id')::uuid)->>'purged_at' = p->>'purged_at';
  assert exists(select 1 from public.asset_events where action = 'publish.revoked') and exists(select 1 from public.asset_events where action = 'publish.purged');
  assert public.asset_revoke_publication(actor,(p2->>'id')::uuid)->>'status' = 'revoked', 'conflicting copies can be revoked too';
  p := public.asset_prepare_publish(actor,(v->>'id')::uuid,'public',gen_random_uuid());
  perform pg_temp.expect_error(format('select public.asset_revoke_publication(%L,%L)',actor,p->>'id'),'PUBLICATION_PENDING');
  perform pg_temp.expect_error(format('select public.asset_prepare_publish(%L,%L,%L,%L)',actor,v->>'id','resume_en',gen_random_uuid()),'INVALID_TYPE');

  insert into storage.objects values('legacy','large','{"size":800000000}');
  perform pg_temp.expect_error(format('select public.asset_begin_upload(%L,%L,%L,%L,100)',actor,gen_random_uuid(),'over.jpg','image/jpeg'),'QUOTA_EXCEEDED');
  raise notice 'PASS: permissions, private bucket, quota, upload idempotency, owner isolation, immutable versions, trash/restore, cancel, publication payload, profile CAS, event retention, references, lapsing reservations, revoke and purge';
end $$;
rollback;

