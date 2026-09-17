import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

// `server-only` throws when imported outside React Server Components. tsx runs these tests as CommonJS,
// so pre-seeding the require cache with an empty module lets the pure helpers in translate.ts load
// without spawning a `--conditions=react-server` child process.
const localRequire = createRequire(import.meta.url);
const serverOnlyPath = localRequire.resolve('server-only');
if (!localRequire.cache[serverOnlyPath]) {
  const stub = new Module(serverOnlyPath);
  stub.filename = serverOnlyPath;
  stub.loaded = true;
  stub.exports = {};
  localRequire.cache[serverOnlyPath] = stub;
}

async function loadTranslate() {
  return import('../src/lib/ai/translate');
}

test('extractJsonObject strips code fences and surrounding prose', async () => {
  const { extractJsonObject } = await loadTranslate();
  assert.equal(extractJsonObject('{"a":1}'), '{"a":1}');
  assert.equal(extractJsonObject('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJsonObject('Here you go:\n{"a":{"b":2}}\nThanks'), '{"a":{"b":2}}');
  assert.throws(() => extractJsonObject('no json here'), /JSON/);
});

test('parseTranslation returns the three fields and rejects wrong shapes', async () => {
  const { parseTranslation } = await loadTranslate();
  assert.deepEqual(parseTranslation('{"title":"T","excerpt":"","body":"# B"}'), { title: 'T', excerpt: '', body: '# B' });
  assert.deepEqual(parseTranslation('```\n{"title":"T","body":"B"}\n```'), { title: 'T', excerpt: '', body: 'B' });
  assert.throws(() => parseTranslation('[1,2]'), /JSON/);
  assert.throws(() => parseTranslation('{"title":1,"excerpt":"","body":""}'), /title/);
  assert.throws(() => parseTranslation('{"title":"x",'), /解析/);
});

test('system prompt names both languages and demands JSON-only output', async () => {
  const { buildSystemPrompt, translationSchema } = await loadTranslate();
  const prompt = buildSystemPrompt('zh', 'en');
  assert.match(prompt, /Traditional Chinese/);
  assert.match(prompt, /into English/);
  assert.match(prompt, /only a JSON object/);
  assert.deepEqual(translationSchema.required, ['title', 'excerpt', 'body']);
  assert.equal(translationSchema.additionalProperties, false);
});

test('translateArticleFields fails fast without an API key', async () => {
  const { translateArticleFields } = await loadTranslate();
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(
      translateArticleFields({ from: 'zh', to: 'en', title: '標題', excerpt: '', body: '' }),
      /ANTHROPIC_API_KEY/,
    );
    await assert.rejects(
      translateArticleFields({ from: 'zh', to: 'zh', title: '標題', excerpt: '', body: '' }),
      /不能相同/,
    );
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});
