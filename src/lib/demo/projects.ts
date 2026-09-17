import type { Project, ProjectMedia, ProjectMetric } from '@/types/content';
import { projectCopy } from './project-copy';
const timestamp = '2026-09-01T00:00:00Z';
export const demoProjects: Project[] = projectCopy.map((copy, index) => ({
  ...copy, id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  body_zh: '先定義輸入與輸出的契約，再處理錯誤情境。\n\n```ts\ntype Result<T> =\n  | { ok: true; data: T }\n  | { ok: false; error: string };\n```\n\n保留足夠的執行紀錄，才能重現問題並驗證修正。',
  body_en: 'Define the input and output contracts, then handle failure cases.\n\n```ts\ntype Result<T> =\n  | { ok: true; data: T }\n  | { ok: false; error: string };\n```\n\nKeep enough execution history to reproduce problems and verify fixes.',
  outcome_zh: '此處預留正式量測結果。公開前應補上測試環境、樣本數與比較基準，不以示範數字代表真實成果。',
  outcome_en: 'Measured results belong here. Add the test environment, sample size and baseline before publishing; sample numbers are not actual outcomes.',
  contribution_zh: '此處示範個人貢獻的寫法：列出自己負責的模組、重要決策，以及從實作中學到的事。',
  contribution_en: 'Use this section to identify the modules you owned, the decisions you made and what you learned.',
  cover_url: '/demo/workspace.svg', cover_alt_zh: '示範專案的資料流程示意圖', cover_alt_en: 'Illustrative project data flow',
  architecture_url: '/demo/architecture.svg', architecture_alt_zh: '輸入經驗證與處理後寫入儲存層的示範架構',
  architecture_alt_en: 'Sample architecture: input passes through validation and processing to storage',
  video_url: null, role_zh: '全端開發', role_en: 'Full-stack development', team_size: 1,
  period_start: '2025-03-01', period_end: '2025-06-01', demo_url: null, repo_url: null,
  status: 'published', published_at: timestamp, is_featured: index < 2, sort_order: index,
  created_at: timestamp, updated_at: timestamp,
}));
export const demoMedia: ProjectMedia[] = demoProjects.map((p, index) => ({
  id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, project_id: p.id,
  url: '/demo/workspace.svg', media_type: 'image', width: 1200, height: 675,
  alt_zh: '示範資料處理工作台', alt_en: 'Sample data processing workspace',
  caption_zh: '示範畫面，正式發布前替換為實際專案截圖。',
  caption_en: 'Illustrative visual. Replace with an actual project screenshot before publishing.',
  sort_order: 0, created_at: timestamp,
}));
export const demoMetrics: ProjectMetric[] = [];
