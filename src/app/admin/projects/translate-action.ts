'use server';

import Anthropic from '@anthropic-ai/sdk';
import { isUnauthorizedError, requireAdmin } from '@/lib/auth/admin';
import { translateFields, type TranslateLang } from '@/lib/ai/translate';
import { projectFieldLabels, projectTextKeys, type ProjectTextFields, type ProjectTextKey } from './fields';

export type TranslateProjectInput = { from: TranslateLang; to: TranslateLang; fields: Partial<ProjectTextFields> };
export type TranslateProjectResult =
  | { ok: true; data: ProjectTextFields }
  | { ok: false; message: string };

const limits: Record<ProjectTextKey, number> = {
  title: 200, summary: 500, problem: 20_000, solution: 20_000, outcome: 20_000, contribution: 20_000,
  body: 60_000, cover_alt: 300, architecture_alt: 300, role: 100,
};
const markdownKeys: ProjectTextKey[] = ['problem', 'solution', 'outcome', 'contribution', 'body'];
const languages: TranslateLang[] = ['zh', 'en'];

function readField(value: unknown, key: ProjectTextKey): string | { error: string } {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return { error: `${projectFieldLabels[key]}欄位格式錯誤。` };
  if (value.length > limits[key]) {
    return { error: `${projectFieldLabels[key]}超過 ${limits[key].toLocaleString('zh-TW')} 字元的上限，請縮短後再翻譯。` };
  }
  return value;
}

export async function translateProjectAction(input: TranslateProjectInput): Promise<TranslateProjectResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (isUnauthorizedError(error)) return { ok: false, message: '請先登入管理員帳號。' };
    return { ok: false, message: '無法確認登入狀態，請稍後再試。' };
  }

  if (!input || typeof input !== 'object' || !input.fields || typeof input.fields !== 'object') {
    return { ok: false, message: '翻譯請求格式錯誤。' };
  }
  const { from, to } = input;
  if (!languages.includes(from) || !languages.includes(to)) return { ok: false, message: '翻譯語言不支援。' };
  if (from === to) return { ok: false, message: '來源語言與目標語言不能相同。' };

  const fields = {} as ProjectTextFields;
  let hasContent = false;
  for (const key of projectTextKeys) {
    const value = readField(input.fields[key], key);
    if (typeof value !== 'string') return { ok: false, message: value.error };
    fields[key] = value.trim();
    if (fields[key]) hasContent = true;
  }
  if (!hasContent) return { ok: false, message: '來源語言沒有可翻譯的內容。' };

  try {
    const record = await translateFields({ from, to, fields, markdownKeys });
    const data = {} as ProjectTextFields;
    for (const key of projectTextKeys) data[key] = record[key] ?? '';
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, message: 'ANTHROPIC_API_KEY 無效，請檢查環境變數。' };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, message: 'AI 服務目前流量過大，請稍後再試。' };
    if (error instanceof Anthropic.APIConnectionError) return { ok: false, message: '無法連線到 AI 服務，請檢查網路後再試。' };
    if (error instanceof Anthropic.APIError) return { ok: false, message: `AI 服務錯誤（${error.status ?? '?'}）：${error.message}` };
    return { ok: false, message: error instanceof Error ? error.message : '翻譯失敗，請稍後再試。' };
  }
}
