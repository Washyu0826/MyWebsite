'use client';

import { useRouter } from 'next/navigation';
import type { Experience } from '@/types/content';
import { ReorderList, type ReorderResult } from '../reorder-list';
import { experienceKindLabels } from '../profile/validation';
import { saveExperienceAction } from './actions';

const initialState = { ok: false, message: '' };

/**
 * Writes the new positions through the unchanged saveExperienceAction. Every field the action
 * validates is resent from the row that is already on screen, so only sort_order actually changes.
 */
export function ReorderExperiences({ experiences }: { experiences: Experience[] }) {
  const router = useRouter();

  async function save(ids: string[]): Promise<ReorderResult> {
    const byId = new Map(experiences.map(item => [item.id, item]));
    for (const [index, id] of ids.entries()) {
      const item = byId.get(id);
      if (!item || item.sort_order === index) continue;
      const data = new FormData();
      data.set('id', item.id);
      data.set('kind', item.kind);
      data.set('org_zh', item.org_zh || '');
      data.set('org_en', item.org_en || '');
      data.set('role_zh', item.role_zh || '');
      data.set('role_en', item.role_en || '');
      data.set('description_zh', item.description_zh || '');
      data.set('description_en', item.description_en || '');
      data.set('start_date', item.start_date);
      data.set('end_date', item.end_date || '');
      data.set('url', item.url || '');
      data.set('sort_order', String(index));
      // Checkboxes only reach a Server Action when they are checked.
      if (item.is_current) data.set('is_current', 'on');
      if (item.is_visible) data.set('is_visible', 'on');
      const result = await saveExperienceAction(initialState, data);
      if (!result.ok) return { ok: false, message: `第 ${index + 1} 筆儲存失敗：${result.message}` };
    }
    router.refresh();
    return { ok: true, message: '經歷排序已儲存。' };
  }

  return <ReorderList itemNoun="經歷" onSave={save}
    hint="公開頁先依排序值、再依開始日期由新到舊顯示。"
    rows={experiences.map(item => ({
      id: item.id,
      label: item.org_zh || item.org_en,
      meta: `${experienceKindLabels[item.kind]} · ${item.role_zh || item.role_en || '—'} · ${item.is_visible ? '公開' : '隱藏'}`,
    }))} />;
}
