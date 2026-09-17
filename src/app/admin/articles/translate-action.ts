'use server';

import Anthropic from '@anthropic-ai/sdk';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { translateArticleFields, type TranslateFields, type TranslateLang } from '@/lib/ai/translate';

export type TranslateArticleInput = TranslateFields & { from: TranslateLang; to: TranslateLang };
export type TranslateArticleResult =
  | { ok: true; data: TranslateFields }
  | { ok: false; message: string };

const limits = { title: 200, excerpt: 1000, body: 60_000 } as const;
const languages: TranslateLang[] = ['zh', 'en'];
const fieldLabels: Record<keyof typeof limits, string> = { title: '標題', excerpt: '摘要', body: '內文' };

function readField(value: unknown, key: keyof typeof limits): string | { error: string } {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return { error: `${fieldLabels[key]}欄位格式錯誤。` };
  if (value.length > limits[key]) {
    return { error: `${fieldLabels[key]}超過 ${limits[key].toLocaleString('zh-TW')} 字元的上限，請縮短後再翻譯。` };
  }
  return value;
}

export async function translateArticleAction(input: TranslateArticleInput): Promise<TranslateArticleResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (isUnauthorizedError(error)) return { ok: false, message: '請先登入管理員帳號。' };
    return { ok: false, message: '無法確認登入狀態，請稍後再試。' };
  }

  if (!input || typeof input !== 'object') return { ok: false, message: '翻譯請求格式錯誤。' };
  const { from, to } = input;
  if (!languages.includes(from) || !languages.includes(to)) return { ok: false, message: '翻譯語言不支援。' };
  if (from === to) return { ok: false, message: '來源語言與目標語言不能相同。' };

  const fields: TranslateFields = { title: '', excerpt: '', body: '' };
  for (const key of ['title', 'excerpt', 'body'] as const) {
    const value = readField(input[key], key);
    if (typeof value !== 'string') return { ok: false, message: value.error };
    fields[key] = value.trim();
  }
  if (!fields.title && !fields.excerpt && !fields.body) {
    return { ok: false, message: '來源語言沒有可翻譯的內容。' };
  }

  try {
    const data = await translateArticleFields({ from, to, ...fields });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, message: 'ANTHROPIC_API_KEY 無效，請檢查環境變數。' };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, message: 'AI 服務目前流量過大，請稍後再試。' };
    if (error instanceof Anthropic.APIConnectionError) return { ok: false, message: '無法連線到 AI 服務，請檢查網路後再試。' };
    if (error instanceof Anthropic.APIError) return { ok: false, message: `AI 服務錯誤（${error.status ?? '?'}）：${error.message}` };
    return { ok: false, message: error instanceof Error ? error.message : '翻譯失敗，請稍後再試。' };
  }
}
