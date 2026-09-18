import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export type TranslateLang = 'zh' | 'en';
export type TranslateFields = { title: string; excerpt: string; body: string };
export type TranslateInput = TranslateFields & { from: TranslateLang; to: TranslateLang };

/** Generic bilingual field translation: any string map in, the same keys out. */
export type TranslateFieldsInput = {
  from: TranslateLang;
  to: TranslateLang;
  /** Field name -> source text. Empty strings are skipped and returned as empty strings. */
  fields: Record<string, string>;
  /** Keys whose content is Markdown (structure must be preserved); every other key is plain text. */
  markdownKeys?: readonly string[];
};

export const TRANSLATE_MODEL = 'claude-opus-5';

const languageNames: Record<TranslateLang, string> = {
  zh: 'Traditional Chinese as written in Taiwan (zh-TW)',
  en: 'English',
};

const articleKeys = ['title', 'excerpt', 'body'] as const;

type FieldSchema = {
  type: 'object';
  properties: Record<string, { type: 'string'; description: string }>;
  required: string[];
  additionalProperties: false;
};

/** Builds the structured-output schema for a set of field keys (all strings, all required). */
export function buildFieldSchema(keys: readonly string[], markdownKeys: readonly string[] = []): FieldSchema {
  const properties: FieldSchema['properties'] = {};
  for (const key of keys) {
    properties[key] = {
      type: 'string',
      description: markdownKeys.includes(key)
        ? `Translated "${key}" in Markdown, preserving the source structure. Empty string when the source is empty.`
        : `Translated "${key}" as plain text (no Markdown). Empty string when the source is empty.`,
    };
  }
  return { type: 'object', properties, required: [...keys], additionalProperties: false };
}

/** JSON schema shared by the structured-output request and the tolerant parser. */
export const translationSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Translated article title (plain text, no Markdown).' },
    excerpt: { type: 'string', description: 'Translated excerpt (plain text, 1-3 sentences). Empty string when the source excerpt is empty.' },
    body: { type: 'string', description: 'Translated article body in Markdown, preserving the source structure.' },
  },
  required: ['title', 'excerpt', 'body'],
  additionalProperties: false,
} as const;

function quoteKeys(keys: readonly string[]) {
  const quoted = keys.map(key => `"${key}"`);
  if (quoted.length <= 1) return quoted.join('');
  return `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
}

export function buildSystemPrompt(from: TranslateLang, to: TranslateLang, keys: readonly string[] = articleKeys) {
  return [
    'You are a professional translator for a personal software-engineering portfolio and blog.',
    `Translate the fields you receive from ${languageNames[from]} into ${languageNames[to]}.`,
    'Rules:',
    '- Preserve the Markdown structure exactly: headings, lists, tables, blockquotes, emphasis, links (keep URLs unchanged) and images.',
    '- Do not translate or modify anything inside fenced code blocks or inline code; keep code comments in the source language unless they are plain prose.',
    '- Keep technical terms, product names, library names, commands, file paths and acronyms in their conventional form (usually English).',
    '- Keep the tone natural for a native reader; do not add, omit or summarise content.',
    '- If a field is an empty string, return an empty string for that field.',
    `- Respond with only a JSON object with the keys ${quoteKeys(keys)} (all strings) and nothing else.`,
  ].join('\n');
}

/** Pulls the outermost JSON object out of a model reply, tolerating code fences and stray prose. */
export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const inner = fenced ? fenced[1].trim() : trimmed;
  if (inner.startsWith('{') && inner.endsWith('}')) return inner;
  const start = inner.indexOf('{');
  const end = inner.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('模型回應中找不到 JSON 物件。');
  return inner.slice(start, end + 1);
}

/** Parses a model reply into a string map containing exactly `keys` (missing keys become ''). */
export function parseTranslationRecord(text: string, keys: readonly string[]): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(text));
  } catch (error) {
    throw new Error(`無法解析翻譯結果：${error instanceof Error ? error.message : '格式錯誤'}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('翻譯結果不是 JSON 物件。');
  const record = parsed as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null) {
      result[key] = '';
      continue;
    }
    if (typeof value !== 'string') throw new Error(`翻譯結果的 ${key} 欄位不是字串。`);
    result[key] = value;
  }
  return result;
}

export function parseTranslation(text: string): TranslateFields {
  const record = parseTranslationRecord(text, articleKeys);
  return { title: record.title, excerpt: record.excerpt, body: record.body };
}

/**
 * Translates every non-empty field with Claude and returns a map with the same keys.
 * Empty source fields are not sent to the model and come back as empty strings.
 */
export async function translateFields(input: TranslateFieldsInput): Promise<Record<string, string>> {
  if (input.from === input.to) throw new Error('來源語言與目標語言不能相同。');
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('尚未設定 ANTHROPIC_API_KEY 環境變數，無法使用 AI 翻譯。');
  }

  const allKeys = Object.keys(input.fields);
  const result: Record<string, string> = {};
  for (const key of allKeys) result[key] = '';

  const source: Record<string, string> = {};
  for (const key of allKeys) {
    const value = input.fields[key];
    if (typeof value === 'string' && value.trim()) source[key] = value;
  }
  const keys = Object.keys(source);
  if (!keys.length) return result;

  const markdownKeys = input.markdownKeys ?? [];
  const client = new Anthropic();

  // Streaming keeps long bodies clear of the HTTP timeout; finalMessage() collects the full reply.
  const response = await client.messages.stream({
    model: TRANSLATE_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: buildFieldSchema(keys, markdownKeys) },
    },
    system: buildSystemPrompt(input.from, input.to, keys),
    messages: [{
      role: 'user',
      content: `Translate every field of this JSON from ${languageNames[input.from]} to ${languageNames[input.to]}:\n\n${JSON.stringify(source, null, 2)}`,
    }],
  }).finalMessage();

  if (response.stop_reason === 'refusal') {
    throw new Error('模型拒絕了這次翻譯請求，請調整內容後再試。');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('內容太長，翻譯結果超過單次輸出上限。請分段翻譯或縮短內容。');
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
  if (!text.trim()) throw new Error('模型沒有回傳任何翻譯內容。');

  const translated = parseTranslationRecord(text, keys);
  for (const key of keys) result[key] = translated[key];
  return result;
}

export async function translateArticleFields(input: TranslateInput): Promise<TranslateFields> {
  const record = await translateFields({
    from: input.from,
    to: input.to,
    fields: { title: input.title, excerpt: input.excerpt, body: input.body },
    markdownKeys: ['body'],
  });
  return { title: record.title, excerpt: record.excerpt, body: record.body };
}
