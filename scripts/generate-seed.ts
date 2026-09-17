import { writeFileSync, mkdirSync } from 'node:fs';
import { demoProfile, demoExperiences, demoSkills } from '../src/lib/demo/profile';
import { demoProjects, demoMedia } from '../src/lib/demo/projects';
function literal(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return `ARRAY[${value.map(literal).join(',')}]::text[]`;
  return `'${String(value).replaceAll("'", "''")}'`;
}
function insert(table: string, records: object[]) {
  return records.map(record => {
    const entries = Object.entries(record);
    return `insert into public.${table} (${entries.map(([key]) => key).join(', ')})\nvalues (${entries.map(([, value]) => literal(value)).join(', ')})\non conflict (id) do nothing;`;
  }).join('\n\n');
}
mkdirSync('supabase', { recursive: true });
const tables = [['experiences', demoExperiences], ['skills', demoSkills], ['projects', demoProjects], ['project_media', demoMedia]] as const;
// Never overwrite an existing real profile or seed row on re-run.
const fields = Object.entries(demoProfile).filter(([key]) => key !== 'id');
const profile = `update public.profile set ${fields.map(([key, value]) => `${key} = ${literal(value)}`).join(', ')}\nwhere id = 1 and name_zh in ('', '你的中文名');`;
writeFileSync('supabase/seed.sql', [
  '-- OPTIONAL SAMPLE CONTENT. Run only in a development Supabase project after schema.sql.',
  '-- Idempotent inserts; existing records are preserved. Replace samples before production.',
  'begin;', profile, ...tables.map(([table, data]) => insert(table, [...data])), 'commit;',
].join('\n\n') + '\n', 'utf8');
