import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env.local'); } catch { /* CI can supply environment variables directly. */ }
const projectId = process.env.SUPABASE_PROJECT_ID;
if (!projectId || !/^[a-z0-9]+$/.test(projectId)) throw new Error('Set SUPABASE_PROJECT_ID in .env.local first.');
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'supabase', 'gen', 'types', 'typescript', '--project-id', projectId, '--schema', 'public',
], { encoding: 'utf8', shell: process.platform === 'win32' });
if (result.status !== 0 || !result.stdout.includes('export type Database')) {
  process.stderr.write(result.stderr || 'Type generation failed. Existing types were preserved.');
  process.exit(1);
}
writeFileSync('src/types/database.ts', result.stdout, 'utf8');
console.log('Updated src/types/database.ts from the live schema.');
