import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { pickLocale } from '../src/lib/locale';
import { documentUrl, emailUrl, resumeUrl, safeUrl } from '../src/lib/urls';
import zh from '../messages/zh.json';
import en from '../messages/en.json';
test('blank English content falls back to Chinese; nonlocalized data is not projected', () => {
  assert.deepEqual(pickLocale({ title_zh: '中文', title_en: '  ', body_zh: null, body_en: null, id: 1 }, 'en'), { title: '中文', body: '' });
  assert.deepEqual(pickLocale({ title_zh: '中文', title_en: 'English' }, 'zh'), { title: '中文' });
});
test('resume selects exact language and does not offer the other language as a substitute', () => {
  const profile = { resume_zh_url: 'https://example.com/zh.pdf', resume_en_url: null };
  // An uploaded file wins; with none for that language the static PDF of the SAME language is
  // served. What must never happen is answering a request for English with the Chinese document.
  assert.equal(resumeUrl(profile, 'en'), '/resumes/kuan-yu-hsien-resume-en.pdf');
  assert.equal(resumeUrl(profile, 'zh'), profile.resume_zh_url);
  assert.equal(resumeUrl({ resume_zh_url: null, resume_en_url: null }, 'zh'), '/resumes/kuan-yu-hsien-resume-zh.pdf');
  assert.equal(documentUrl('/resumes/kuan-yu-hsien-resume-en.pdf'), '/resumes/kuan-yu-hsien-resume-en.pdf');
  assert.equal(documentUrl('//example.com/resume.pdf'), null);
});
test('content links reject executable schemes and email values cannot inject headers', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,test'), null);
  assert.equal(safeUrl('https://example.com/work'), 'https://example.com/work');
  assert.equal(emailUrl('a@example.com\nBcc: b@example.com'), null);
  assert.equal(emailUrl('a@example.com?subject=x'), 'mailto:a%40example.com%3Fsubject%3Dx');
});
test('both interface dictionaries expose the same translation keys', () => {
  function keys(value: object, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, entry]) => typeof entry === 'object' ? keys(entry, `${prefix}${key}.`) : `${prefix}${key}`).sort();
  }
  assert.deepEqual(keys(zh), keys(en));
});
// config.ts imports `server-only`, so it is evaluated in a child process under the `react-server`
// export condition with a controlled environment instead of being imported into this test file.
function demoMode(env: Record<string, string>) {
  const script = "import('./src/lib/db/config.ts').then(m => { const c = m.default?.isDemoMode ? m.default : m; console.log(JSON.stringify([c.isDemoMode(), c.isDemoMode()])); })";
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', '-e', script], {
    cwd: process.cwd(), encoding: 'utf8',
    env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT ?? '', HOME: process.env.HOME ?? '', ...env } as unknown as NodeJS.ProcessEnv,
  });
  assert.equal(result.status, 0, result.stderr);
  const warnings = result.stderr.split('DEMO_MODE=true ignored in production').length - 1;
  return { values: JSON.parse(result.stdout.trim()) as [boolean, boolean], warnings };
}
test('DEMO_MODE=true is honoured outside production but ignored, with a single warning, on production deployments', () => {
  assert.deepEqual(demoMode({ DEMO_MODE: 'true', NODE_ENV: 'development' }), { values: [true, true], warnings: 0 });
  assert.deepEqual(demoMode({ DEMO_MODE: 'true', NODE_ENV: 'production' }), { values: [true, true], warnings: 0 });
  assert.deepEqual(demoMode({ DEMO_MODE: 'true', VERCEL_ENV: 'production' }), { values: [false, false], warnings: 1 });
  assert.deepEqual(demoMode({ DEMO_MODE: 'true', NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }), { values: [true, true], warnings: 0 });
  assert.deepEqual(demoMode({ NODE_ENV: 'production' }), { values: [false, false], warnings: 0 });
  assert.deepEqual(demoMode({ NODE_ENV: 'development' }), { values: [true, true], warnings: 0 });
});
