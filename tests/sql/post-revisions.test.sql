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
  actor uuid := '33333333-3333-4333-8333-333333333333';
  post uuid;
  first jsonb; second jsonb; again jsonb; n integer;
begin
  insert into auth.users values(actor) on conflict do nothing;
  insert into public.posts(slug,title_zh,body_zh) values('revisions','修訂','第一版') returning id into post;

  assert not has_table_privilege('anon','public.post_revisions','SELECT');
  assert not has_table_privilege('authenticated','public.post_revisions','SELECT');
  assert not has_function_privilege('authenticated','public.post_save_revision(uuid,uuid,jsonb,text)','EXECUTE');
  assert has_function_privilege('service_role','public.post_save_revision(uuid,uuid,jsonb,text)','EXECUTE');
  assert (select relrowsecurity from pg_class where relname = 'post_revisions');

  first := public.post_save_revision(actor,post,'{"title_zh":"修訂","body_zh":"第一版"}'::jsonb);
  assert (first->>'revision')::integer = 1;
  assert first->>'reason' = 'save';
  assert first->>'actor_id' = actor::text;

  -- Saving the same content again must not fill the history with copies.
  again := public.post_save_revision(actor,post,'{"title_zh":"修訂","body_zh":"第一版"}'::jsonb);
  assert again->>'id' = first->>'id', 'an identical snapshot reuses the latest revision';
  assert (select count(*) from public.post_revisions where post_id = post) = 1;

  second := public.post_save_revision(actor,post,'{"title_zh":"修訂","body_zh":"第二版"}'::jsonb,'restore');
  assert (second->>'revision')::integer = 2 and second->>'reason' = 'restore';
  -- Key order must not create a spurious revision: jsonb compares by content, not by text.
  assert public.post_save_revision(actor,post,'{"body_zh":"第二版","title_zh":"修訂"}'::jsonb)->>'id' = second->>'id';

  perform pg_temp.expect_error(format('select public.post_save_revision(%L,%L,%L)',actor,post,'"text"'),'INVALID_REQUEST');
  perform pg_temp.expect_error(format('select public.post_save_revision(%L,%L,%L,%L)',actor,post,'{}','purge'),'INVALID_REQUEST');
  perform pg_temp.expect_error(format('select public.post_save_revision(%L,%L,%L)',actor,gen_random_uuid(),'{}'),'POST_NOT_FOUND');

  -- Revisions belong to their article and go with it.
  select count(*) into n from public.post_revisions where post_id = post;
  assert n = 2;
  delete from public.posts where id = post;
  assert (select count(*) from public.post_revisions where post_id = post) = 0, 'revisions cascade with the article';

  raise notice 'PASS: revision numbering, deduplicated snapshots, key-order independence, input validation, permissions, cascade';
end $$;
rollback;
