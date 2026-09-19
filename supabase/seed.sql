-- OPTIONAL SAMPLE CONTENT. Run only in a development Supabase project after `supabase db push`.

-- Idempotent inserts; existing records are preserved. Replace samples before production.

begin;

update public.profile set name_zh = 'Hsien', name_en = 'Hsien', headline_zh = 'Software Engineer', headline_en = 'Software Engineer', bio_zh = 'Curiosity driven, clarity obsessed.', bio_en = 'Curiosity driven, clarity obsessed.', now_zh = 'CS undergrad · Looking for 2027 new-grad roles', now_en = 'CS undergrad · Looking for 2027 new-grad roles', location_zh = '台灣', location_en = 'Taiwan', email = 'hi@example.com', avatar_url = null, resume_zh_url = null, resume_en_url = null, resume_updated_at = null, seo_description_zh = '', seo_description_en = '', updated_at = '2026-09-01T00:00:00Z'
where id = 1 and name_zh in ('', '你的中文名');

insert into public.social_links (platform, label, url, sort_order)
select 'linkedin', 'LinkedIn', 'https://linkedin.com/in/', 2
where not exists (select 1 from public.social_links where platform = 'linkedin');

insert into public.social_links (platform, label, url, sort_order)
select 'github', 'GitHub', 'https://github.com/', 3
where not exists (select 1 from public.social_links where platform = 'github');

insert into public.experiences (id, kind, org_zh, org_en, role_zh, role_en, description_zh, description_en, start_date, end_date, is_current, url, sort_order, is_visible, created_at, updated_at)
values ('10000000-0000-4000-8000-000000000001', 'education', '資訊科學系（示範）', 'Computer Science (sample)', '學士班', 'Undergraduate', '透過專案實作，學習系統設計、資料處理與軟體工程。', 'Learning system design, data processing and software engineering through projects.', '2023-09-01', null, true, null, 0, true, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000000', '語言', 'Languages', 0, 'TypeScript', 0, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000001', '語言', 'Languages', 0, 'Python', 1, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000002', '語言', 'Languages', 0, 'SQL', 2, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000010', '前端', 'Frontend', 1, 'React', 0, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000011', '前端', 'Frontend', 1, 'Next.js', 1, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000012', '前端', 'Frontend', 1, 'Tailwind CSS', 2, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000020', '資料與 AI', 'Data & AI', 2, 'PostgreSQL', 0, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000021', '資料與 AI', 'Data & AI', 2, 'pandas', 1, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000022', '資料與 AI', 'Data & AI', 2, 'PyTorch', 2, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000030', '基礎設施', 'Infrastructure', 3, 'Docker', 0, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000031', '基礎設施', 'Infrastructure', 3, 'Git', 1, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.skills (id, category_zh, category_en, category_order, name, sort_order, is_visible, created_at)
values ('20000000-0000-4000-8000-000000000032', '基礎設施', 'Infrastructure', 3, 'Supabase', 2, true, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.projects (slug, title_zh, title_en, summary_zh, summary_en, tags, tech_stack, problem_zh, problem_en, solution_zh, solution_en, id, body_zh, body_en, outcome_zh, outcome_en, contribution_zh, contribution_en, cover_url, cover_alt_zh, cover_alt_en, architecture_url, architecture_alt_zh, architecture_alt_en, video_url, role_zh, role_en, team_size, period_start, period_end, demo_url, repo_url, status, published_at, is_featured, sort_order, created_at, updated_at)
values ('document-search', '文件檢索工作台', 'Document search workspace', '讓分散的技術文件，成為附有來源的答案。', 'Turn scattered technical documents into answers with sources.', ARRAY['web','data-ai']::text[], ARRAY['Next.js','TypeScript','PostgreSQL','pgvector']::text[], '這是一份示範案例。文件散落在不同資料夾，使用者需要重複搜尋與比對，才能確認答案來源。', 'This is an illustrative case study. Documents are spread across folders, requiring repeated searches to verify sources.', '將文件切分為可追溯的段落，結合關鍵字與向量搜尋。每個結果保留文件名稱與原始段落，方便核對。', 'Split documents into traceable passages and combine keyword and vector search. Keep the source document and original passage with each result.', '30000000-0000-4000-8000-000000000001', '先定義輸入與輸出的契約，再處理錯誤情境。

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

保留足夠的執行紀錄，才能重現問題並驗證修正。', 'Define the input and output contracts, then handle failure cases.

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

Keep enough execution history to reproduce problems and verify fixes.', '此處預留正式量測結果。公開前應補上測試環境、樣本數與比較基準，不以示範數字代表真實成果。', 'Measured results belong here. Add the test environment, sample size and baseline before publishing; sample numbers are not actual outcomes.', '此處示範個人貢獻的寫法：列出自己負責的模組、重要決策，以及從實作中學到的事。', 'Use this section to identify the modules you owned, the decisions you made and what you learned.', '/demo/workspace.svg', '示範專案的資料流程示意圖', 'Illustrative project data flow', '/demo/architecture.svg', '輸入經驗證與處理後寫入儲存層的示範架構', 'Sample architecture: input passes through validation and processing to storage', null, '全端開發', 'Full-stack development', 1, '2025-03-01', '2025-06-01', null, null, 'published', '2026-09-01T00:00:00Z', true, 0, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.projects (slug, title_zh, title_en, summary_zh, summary_en, tags, tech_stack, problem_zh, problem_en, solution_zh, solution_en, id, body_zh, body_en, outcome_zh, outcome_en, contribution_zh, contribution_en, cover_url, cover_alt_zh, cover_alt_en, architecture_url, architecture_alt_zh, architecture_alt_en, video_url, role_zh, role_en, team_size, period_start, period_end, demo_url, repo_url, status, published_at, is_featured, sort_order, created_at, updated_at)
values ('data-quality', '資料品質觀測站', 'Data quality observatory', '在資料進入報表之前，找出缺漏與異常。', 'Find missing values and anomalies before they reach a report.', ARRAY['data-ai','tool']::text[], ARRAY['Python','pandas','PostgreSQL','Docker']::text[], '這是一份示範案例。定期匯入的資料格式不一致，問題通常到產出報表時才被發現。', 'This is an illustrative case study. Imported data has inconsistent formats, and problems often surface only when reports are generated.', '建立欄位型別、空值比例與重複資料檢查。每次執行保留結果，讓資料品質變化可以追蹤。', 'Validate field types, missing-value ratios and duplicate records. Keep the results of each run to track quality over time.', '30000000-0000-4000-8000-000000000002', '先定義輸入與輸出的契約，再處理錯誤情境。

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

保留足夠的執行紀錄，才能重現問題並驗證修正。', 'Define the input and output contracts, then handle failure cases.

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

Keep enough execution history to reproduce problems and verify fixes.', '此處預留正式量測結果。公開前應補上測試環境、樣本數與比較基準，不以示範數字代表真實成果。', 'Measured results belong here. Add the test environment, sample size and baseline before publishing; sample numbers are not actual outcomes.', '此處示範個人貢獻的寫法：列出自己負責的模組、重要決策，以及從實作中學到的事。', 'Use this section to identify the modules you owned, the decisions you made and what you learned.', '/demo/workspace.svg', '示範專案的資料流程示意圖', 'Illustrative project data flow', '/demo/architecture.svg', '輸入經驗證與處理後寫入儲存層的示範架構', 'Sample architecture: input passes through validation and processing to storage', null, '全端開發', 'Full-stack development', 1, '2025-03-01', '2025-06-01', null, null, 'published', '2026-09-01T00:00:00Z', true, 1, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.projects (slug, title_zh, title_en, summary_zh, summary_en, tags, tech_stack, problem_zh, problem_en, solution_zh, solution_en, id, body_zh, body_en, outcome_zh, outcome_en, contribution_zh, contribution_en, cover_url, cover_alt_zh, cover_alt_en, architecture_url, architecture_alt_zh, architecture_alt_en, video_url, role_zh, role_en, team_size, period_start, period_end, demo_url, repo_url, status, published_at, is_featured, sort_order, created_at, updated_at)
values ('task-queue', '非同步任務佇列', 'Asynchronous task queue', '把耗時工作移出請求流程，讓失敗能夠重試。', 'Move slow work out of requests and make failures retryable.', ARRAY['web','tool']::text[], ARRAY['TypeScript','Redis','PostgreSQL','Docker']::text[], '這是一份示範案例。耗時任務會阻塞使用者請求，重新送出又可能造成重複處理。', 'This is an illustrative case study. Slow tasks block requests, and resubmission can cause duplicate processing.', '將任務存入佇列，使用冪等鍵與明確的狀態轉移，支援重試與執行紀錄查詢。', 'Queue tasks with idempotency keys and explicit state transitions. Support retries and an inspectable execution history.', '30000000-0000-4000-8000-000000000003', '先定義輸入與輸出的契約，再處理錯誤情境。

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

保留足夠的執行紀錄，才能重現問題並驗證修正。', 'Define the input and output contracts, then handle failure cases.

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

Keep enough execution history to reproduce problems and verify fixes.', '此處預留正式量測結果。公開前應補上測試環境、樣本數與比較基準，不以示範數字代表真實成果。', 'Measured results belong here. Add the test environment, sample size and baseline before publishing; sample numbers are not actual outcomes.', '此處示範個人貢獻的寫法：列出自己負責的模組、重要決策，以及從實作中學到的事。', 'Use this section to identify the modules you owned, the decisions you made and what you learned.', '/demo/workspace.svg', '示範專案的資料流程示意圖', 'Illustrative project data flow', '/demo/architecture.svg', '輸入經驗證與處理後寫入儲存層的示範架構', 'Sample architecture: input passes through validation and processing to storage', null, '全端開發', 'Full-stack development', 1, '2025-03-01', '2025-06-01', null, null, 'published', '2026-09-01T00:00:00Z', false, 2, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.projects (slug, title_zh, title_en, summary_zh, summary_en, tags, tech_stack, problem_zh, problem_en, solution_zh, solution_en, id, body_zh, body_en, outcome_zh, outcome_en, contribution_zh, contribution_en, cover_url, cover_alt_zh, cover_alt_en, architecture_url, architecture_alt_zh, architecture_alt_en, video_url, role_zh, role_en, team_size, period_start, period_end, demo_url, repo_url, status, published_at, is_featured, sort_order, created_at, updated_at)
values ('personal-site', '雙語個人檔案', 'Bilingual personal index', '用可快速檢索的案例，記錄工程實作與取捨。', 'An accessible index of engineering work and decisions.', ARRAY['web']::text[], ARRAY['Next.js','Supabase','Tailwind CSS','next-intl']::text[], '這是一份示範案例。作品只列技術名稱，難以讓讀者快速理解問題背景與個人貢獻。', 'This is an illustrative case study. Technology lists alone do not explain the problem or individual contribution.', '以案例敘事為核心，將角色、期間與技術放在固定欄位，提供中英雙語與手機優先的閱讀介面。', 'Build around case studies, with fixed fields for role, period and technology. Provide bilingual content and a mobile-first reading experience.', '30000000-0000-4000-8000-000000000004', '先定義輸入與輸出的契約，再處理錯誤情境。

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

保留足夠的執行紀錄，才能重現問題並驗證修正。', 'Define the input and output contracts, then handle failure cases.

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

Keep enough execution history to reproduce problems and verify fixes.', '此處預留正式量測結果。公開前應補上測試環境、樣本數與比較基準，不以示範數字代表真實成果。', 'Measured results belong here. Add the test environment, sample size and baseline before publishing; sample numbers are not actual outcomes.', '此處示範個人貢獻的寫法：列出自己負責的模組、重要決策，以及從實作中學到的事。', 'Use this section to identify the modules you owned, the decisions you made and what you learned.', '/demo/workspace.svg', '示範專案的資料流程示意圖', 'Illustrative project data flow', '/demo/architecture.svg', '輸入經驗證與處理後寫入儲存層的示範架構', 'Sample architecture: input passes through validation and processing to storage', null, '全端開發', 'Full-stack development', 1, '2025-03-01', '2025-06-01', null, null, 'published', '2026-09-01T00:00:00Z', false, 3, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.project_media (id, project_id, url, media_type, width, height, alt_zh, alt_en, caption_zh, caption_en, sort_order, created_at)
values ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '/demo/workspace.svg', 'image', 1200, 675, '示範資料處理工作台', 'Sample data processing workspace', '示範畫面，正式發布前替換為實際專案截圖。', 'Illustrative visual. Replace with an actual project screenshot before publishing.', 0, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.project_media (id, project_id, url, media_type, width, height, alt_zh, alt_en, caption_zh, caption_en, sort_order, created_at)
values ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '/demo/workspace.svg', 'image', 1200, 675, '示範資料處理工作台', 'Sample data processing workspace', '示範畫面，正式發布前替換為實際專案截圖。', 'Illustrative visual. Replace with an actual project screenshot before publishing.', 0, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.project_media (id, project_id, url, media_type, width, height, alt_zh, alt_en, caption_zh, caption_en, sort_order, created_at)
values ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '/demo/workspace.svg', 'image', 1200, 675, '示範資料處理工作台', 'Sample data processing workspace', '示範畫面，正式發布前替換為實際專案截圖。', 'Illustrative visual. Replace with an actual project screenshot before publishing.', 0, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.project_media (id, project_id, url, media_type, width, height, alt_zh, alt_en, caption_zh, caption_en, sort_order, created_at)
values ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', '/demo/workspace.svg', 'image', 1200, 675, '示範資料處理工作台', 'Sample data processing workspace', '示範畫面，正式發布前替換為實際專案截圖。', 'Illustrative visual. Replace with an actual project screenshot before publishing.', 0, '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

commit;
