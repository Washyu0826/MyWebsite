import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Intentionally fixed to a loopback test database. Never accepts a production DATABASE_URL.
const execute = promisify(execFile);
const binary = process.env.PSQL_BINARY || (process.platform === 'win32' ? 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe' : 'psql');
const port = Number(process.env.ASSET_TEST_PG_PORT || 55432);
assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
const args = ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'asset_library_test', '-v', 'ON_ERROR_STOP=1', '-qAt'];
const sql = async query => (await execute(binary, [...args, '-c', query], { windowsHide: true })).stdout.trim();
assert.equal(await sql('select current_database()'), 'asset_library_test');
// Every run starts from an empty database: the fixture, the migration and the assertions below all
// assume no leftover rows (usage accounting in particular), and the concurrency checks after the SQL
// file insert rows outside its transaction.
await sql('drop schema if exists public, auth, storage cascade; create schema public; grant all on schema public to public;');
await execute(
  binary,
  [
    ...args,
    '-f',
    'tests/sql/asset-library-fixture.sql',
    ...[
      'supabase/migrations/20260920000100_asset_library.sql',
      'supabase/migrations/20260920000200_media_dimensions.sql',
      'supabase/migrations/20260920000300_asset_references.sql',
      'supabase/migrations/20260920000400_asset_revoke.sql',
    ].flatMap(file => ['-f', file, '-f', file]),
    '-f',
    'tests/sql/asset-library.test.sql',
  ],
  { windowsHide: true },
);

const actor = randomUUID();
const request = randomUUID();
await sql(`insert into auth.users values ('${actor}')`);
const begin = `select public.asset_begin_upload('${actor}','${request}','race.jpg','image/jpeg',8)`;
const [first, second] = await Promise.all([sql(begin), sql(begin)]);
const version = JSON.parse(first);
assert.equal(JSON.parse(second).id, version.id, 'simultaneous retries produce one version');
assert.equal(await sql(`select count(*) from public.asset_events where asset_id='${version.asset_id}'`), '1');
await sql(
  `insert into storage.objects values ('assets-private','${version.object_path}','{"size":8}'); select public.asset_finish_upload('${actor}','${version.id}',8,'image/jpeg','${'a'.repeat(64)}')`,
);
const outcomes = await Promise.allSettled(
  [1, 2].map(() => sql(`select public.asset_begin_upload('${actor}','${randomUUID()}','next.jpg','image/jpeg',8,'${version.asset_id}')`)),
);
assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1, 'one pending writer per asset');
assert.match(outcomes.find(result => result.status === 'rejected').reason.stderr, /UPLOAD_PENDING/);
assert.equal(await sql(`select count(*) from public.asset_versions where asset_id='${version.asset_id}'`), '2');
console.log('PASS: SQL regression, repeatable migration, real concurrent idempotency and per-asset writer serialization');
