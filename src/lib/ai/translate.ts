import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export type TranslateLang = 'zh' | 'en';
export type TranslateFields = { title: string; excerpt: string; body: string };
export type TranslateInput = TranslateFields & { from: TranslateLang; to: TranslateLang };

export const TRANSLATE_MODEL = 'claude-opus-5';

const languageNames: Record<TranslateLang, string> = {
  zh: 'Traditional Chinese as written in Taiwan (zh-TW)',
  en: 'English',
};

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

export function buildSystemPrompt(from: TranslateLang, to: TranslateLang) {
  return [
    'You are a professional translator for a personal software-engineering blog.',
    `Translate the article fields you receive from ${languageNames[from]} into ${languageNames[to]}.`,
    'Rules:',
    '- Preserve the Markdown structure exactly: headings, lists, tables, blockquotes, emphasis, links (keep URLs unchanged) and images.',
    '- Do not translate or modify anything inside fenced code blocks or inline code; keep code comments in the source language unless they are plain prose.',
    '- Keep technical terms, product names, library names, commands, file paths and acronyms in their conventional form (usually English).',
    '- Keep the tone natural for a native reader; do not add, omit or summarise content.',
    '- If a field is an empty string, return an empty string for that field.',
    '- Respond with only a JSON object with the keys "title", "excerpt" and "body" (all strings) and nothing else.',
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

export function parseTranslation(text: string): TranslateFields {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(text));
  } catch (error) {
    throw new Error(`無法解析翻譯結果：${error instanceof Error ? error.message : '格式錯誤'}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('翻譯結果不是 JSON 物件。');
  const record = parsed as Record<string, unknown>;
  const pick = (key: keyof TranslateFields) => {
    const value = record[key];
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') throw new Error(`翻譯結果的 ${key} 欄位不是字串。`);
    return value;
  };
  return { title: pick('title'), excerpt: pick('excerpt'), body: pick('body') };
}

export async function translateArticleFields(input: TranslateInput): Promise<TranslateFields> {
  if (input.from === input.to) throw new Error('來源語言與目標語言不能相同。');
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('尚未設定 ANTHROPIC_API_KEY 環境變數，無法使用 AI 翻譯。');
  }

  const client = new Anthropic();
  const source: TranslateFields = { title: input.title, excerpt: input.excerpt, body: input.body };

  // Streaming keeps long bodies clear of the HTTP timeout; finalMessage() collects the full reply.
  const response = await client.messages.stream({
    model: TRANSLATE_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: translationSchema },
    },
    system: buildSystemPrompt(input.from, input.to),
    messages: [{
      role: 'user',
      content: `Translate every field of this article JSON from ${languageNames[input.from]} to ${languageNames[input.to]}:\n\n${JSON.stringify(source, null, 2)}`,
    }],
  }).finalMessage();

  if (response.stop_reason === 'refusal') {
    throw new Error('模型拒絕了這次翻譯請求，請調整內容後再試。');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('文章太長，翻譯結果超過單次輸出上限。請分段翻譯或縮短內容。');
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
  if (!text.trim()) throw new Error('模型沒有回傳任何翻譯內容。');
  return parseTranslation(text);
}
