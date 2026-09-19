-- =============================================================
-- 真實內容種子（依 2026-04 中英履歷整理，2026-09-18 產生）
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上整份執行。
-- 需先套用 migrations（supabase db push）。
--
-- 規則：
--   profile        覆寫 id=1；姓名與 Email 只在空白或示範值時才寫入。
--   experiences    固定 UUID，on conflict do nothing → 重跑不會蓋掉後台的修改。
--   projects       全部為 draft，固定 UUID，on conflict do nothing。請在 /admin/projects
--                  補上細節與圖片後再改成 published。
--   social_links   只在 platform 不存在時插入，網址請在 /admin/social 填真實連結。
--
-- 標示【請確認】的欄位是履歷上沒有明確日期或內容，為合理推估。
-- =============================================================

begin;

-- -------------------------------------------------------------
-- profile
-- -------------------------------------------------------------
insert into public.profile (id) values (1) on conflict (id) do nothing;

update public.profile set
  -- 姓名只在尚未設定或仍是示範值時覆寫，保留後台的手動調整。
  name_zh = case when name_zh in ('', 'Hsien', '你的中文名') then '冼冠宇' else name_zh end,
  name_en = case when name_en in ('', 'Hsien') then 'Kuan-Yu Hsien' else name_en end,
  headline_zh = 'Software / AI Engineer',
  headline_en = 'Software / AI Engineer',
  now_zh = '政大資科碩士生 · 國泰金控、H2U 永悅健康實習中',
  now_en = 'CS undergrad · Looking for 2027 new-grad roles',
  bio_zh = '對人工智慧與機器學習充滿熱忱，碩士研究聚焦於深度學習應用，具備模型訓練、資料管線建置與雲端部署經驗。

擅長將 AI 技術落地為實際解決方案，並有醫療健康產業資料分析實務背景，期望持續深耕 AI 工程領域。',
  bio_en = 'I thrive on exploring the unknown, turning ideas into working solutions and levelling up through every iteration.

My graduate research focuses on applied deep learning, with hands-on experience in model training, data pipelines and cloud deployment. I also bring practical data-analysis experience from the healthcare industry, and strong communication and leadership experience across several organisations.',
  location_zh = '台灣 台北市 大安區',
  location_en = 'Da''an Dist., Taipei, Taiwan',
  email = case when email in ('', 'hi@example.com') then 'xianguanyu925@gmail.com' else email end,
  seo_description_zh = '冼冠宇（Kuan-Yu Hsien）：政大資訊科學碩士生，專注於深度學習應用、LLM／RAG 系統與雲端部署的軟體／AI 工程師。',
  seo_description_en = 'Kuan-Yu Hsien: MSCS student at National Chengchi University and software / AI engineer focused on applied deep learning, LLM / RAG systems and cloud deployment.',
  updated_at = now()
where id = 1;

-- -------------------------------------------------------------
-- social_links（網址可到 /admin/social 修改；電話用 tel:、LINE 用 line.me 加好友連結）
-- -------------------------------------------------------------
insert into public.social_links (platform, label, url, sort_order, is_visible)
select 'email', 'Email', 'mailto:xianguanyu925@gmail.com', 1, true
where not exists (select 1 from public.social_links where platform = 'email');

insert into public.social_links (platform, label, url, sort_order, is_visible)
select 'phone', '電話', 'tel:+886 0961160826', 4, true
where not exists (select 1 from public.social_links where platform = 'phone');

insert into public.social_links (platform, label, url, sort_order, is_visible)
select 'line', 'LINE', 'https://line.me/ti/p/~zenobia0826', 5, true
where not exists (select 1 from public.social_links where platform = 'line');

insert into public.social_links (platform, label, url, sort_order, is_visible)
select 'instagram', 'Instagram', 'https://www.instagram.com/ryan.hsien_ky0826', 6, true
where not exists (select 1 from public.social_links where platform = 'instagram');

insert into public.social_links (platform, label, url, sort_order, is_visible)
select 'linkedin', 'LinkedIn', 'https://www.linkedin.com/in/', 2, false   -- 【請確認】填入網址後改 is_visible = true
where not exists (select 1 from public.social_links where platform = 'linkedin');

insert into public.social_links (platform, label, url, sort_order, is_visible)
select 'github', 'GitHub', 'https://github.com/', 3, false                -- 【請確認】填入網址後改 is_visible = true
where not exists (select 1 from public.social_links where platform = 'github');

-- -------------------------------------------------------------
-- experiences
-- -------------------------------------------------------------
insert into public.experiences (id, kind, org_zh, org_en, role_zh, role_en, description_zh, description_en, start_date, end_date, is_current, url, sort_order, is_visible)
values
-- 工作
('11000000-0000-4000-8000-000000000001', 'work',
 '國泰金融控股股份有限公司', 'Cathay Financial Holdings',
 '雲端策略發展部／雲端技術科 實習生', 'Intern, Cloud Strategy & Technology',
 '- 開發 Rules MCP Server（Spring Boot），以可擴展架構將保險理賠規則從自然語言自動轉換為結構化 JSON。
- 涵蓋規則推薦、生成與驗證的完整流程，加速理賠規則上線與維護效率。',
 '- Built a Rules MCP Server (Spring Boot) that converts insurance claim rules from natural language into structured JSON on an extensible architecture.
- Covers the full recommend → generate → validate workflow, shortening the time to ship and maintain claim rules.',
 '2026-02-01', null, true, null, 10, true),

('11000000-0000-4000-8000-000000000002', 'work',
 'H2U 永悅健康股份有限公司', 'H2U Health',
 '數位健康研發處 系統開發部 實習生', 'Intern, Digital Health R&D',
 '- 為月流量千萬、用戶平均停留 8.4 分鐘的「早安健康」打造基於 fine-tuned LLM 與 RAG 的繁中健康問答系統。
- 將用戶從搜尋多篇文章壓縮為一句話得到整合答案。',
 '- Built a Traditional-Chinese health Q&A system on a fine-tuned LLM with RAG for EDH (10M+ monthly visits, 8.4 min average session).
- Turns a multi-article search into a single integrated answer.',
 '2026-02-01', null, true, null, 20, true),

('11000000-0000-4000-8000-000000000003', 'work',
 '國立政治大學 通識中心', 'National Chengchi University, General Education Center',
 '程式設計概論 教學助理', 'Teaching Assistant, Introduction to Programming',
 '- 帶領 2 班共 120 位同學進行每週實作與作業輔導，協助課程教學與學習成效提升。',
 '- Led weekly labs and assignment tutoring for two classes (120 students), supporting teaching and learning outcomes.',
 '2024-09-01', '2025-06-30', false, null, 30, true),

-- 學歷
('11000000-0000-4000-8000-000000000011', 'education',
 '國立政治大學', 'National Chengchi University (NCCU)',
 '資訊科學系 碩士', 'M.S. in Computer Science',
 '- 研究多模態 AI 模型，與台大醫院神經外科合作，聚焦帕金森氏症早期偵測與模型建置。
- 修習資料探勘、資料科學、機器學習、深度學習，並具 AWS 雲端服務實作經驗。
- 建置分析台北租屋市場的資料科學系統，以機器學習模型預測租金分布。',
 '- Graduate thesis with NTUH Neurosurgery: a multimodal AI model for early-stage Parkinson''s disease detection.
- Coursework in data mining, data science, machine learning and deep learning, with hands-on AWS experience.
- Built a data-science system analysing Taipei''s rental market, predicting rent distributions with ML models.',
 '2024-09-01', null, true, 'https://www.nccu.edu.tw', 100, true),

('11000000-0000-4000-8000-000000000012', 'education',
 '長庚大學', 'Chang Gung University (CGU)',
 '電機工程學系 學士', 'B.S. in Electrical Engineering',
 '- 電子電路、工程數學與訊號理論的紮實基礎。',
 '- Solid foundations in electronic circuits, engineering mathematics and signal theory.',
 '2019-09-01', '2023-06-30', false, 'https://www.cgu.edu.tw', 110, true),

-- 社團／活動（日期為推估，【請確認】）
('11000000-0000-4000-8000-000000000021', 'activity',
 '國立政治大學 創業聯會', 'NCCU Entrepreneurship Association',
 '活動長', 'Head of Events',
 '- 帶領 8 人團隊負責活動主題企劃、講者邀請與宣傳招生。
- 籌辦 3 場工作坊（每場 30+ 人），平均滿意度 4.1 / 5。
- 與外部企業、加速器與生態系夥伴合作舉辦創新講座、工作坊與競賽。',
 '- Led an 8-person team owning event themes, speaker outreach and promotion.
- Ran 3 workshops (30+ attendees each) with an average satisfaction of 4.1 / 5.
- Partnered with companies, accelerators and ecosystem stakeholders to co-organise talks, workshops and competitions.',
 '2024-09-01', '2025-06-30', false, null, 200, true),

('11000000-0000-4000-8000-000000000022', 'activity',
 '國立政治大學 管理顧問社', 'NCCU Consulting Club',
 '組長', 'Learning Group Leader',
 '- 帶領 6 人小組進行跨產業 mini case study 與成果分享，期末組員滿意度 4.6 / 5。
- 每週帶讀產業報告、新聞洞察與個案，培養組員的結構化思考與商業問題分析能力。',
 '- Led a 6-person group through cross-industry mini case studies and final presentations; member satisfaction 4.6 / 5.
- Facilitated weekly sessions on industry reports, news insights and cases, coaching structured thinking and business problem solving.',
 '2024-09-01', '2025-06-30', false, null, 210, true),

('11000000-0000-4000-8000-000000000023', 'activity',
 '國立政治大學 金融產業研究社', 'NCCU Financial Industry Research Club',
 '專案研究分析師', 'Project Research Analyst',
 '- 進行台灣被動元件產業分析（聚焦 MLCC），整合供應鏈動態、競爭定位與終端市場需求趨勢。',
 '- Industry analysis of Taiwan''s passive components sector (MLCC focus), synthesising supply-chain dynamics, competitive positioning and end-market demand.',
 '2024-09-01', '2025-06-30', false, null, 220, true),

('11000000-0000-4000-8000-000000000024', 'activity',
 'STP 第 23 屆 Talent Seed Program', 'STP 23rd Talent Seed Program',
 '學員', 'Participant',
 '- 與永光化學合作研究 TNFD（自然相關財務揭露）趨勢，撰寫初步 TNFD 策略提案，分析自然相關風險、影響路徑與揭露框架。',
 '- Research project with Eternal Materials on TNFD trends; drafted a preliminary TNFD strategy analysing nature-related risks, impact pathways and disclosure frameworks.',
 '2025-01-01', '2025-06-30', false, null, 230, true),

('11000000-0000-4000-8000-000000000025', 'activity',
 '2025 Epoch School YEFer 創業計畫', '2025 Epoch School YEFer Entrepreneurship Program',
 'Infintas 團隊 CTO', 'CTO, Infintas team',
 '- 擔任 Infintas 團隊技術長，開發 AIoT 語音控制助理。',
 '- Served as CTO of the Infintas team, developing an AIoT voice-controlled assistant.',
 '2025-01-01', '2025-12-31', false, null, 240, true),

-- 特殊經歷
('11000000-0000-4000-8000-000000000031', 'award',
 '戴爾卡內基訓練', 'Dale Carnegie Training',
 '結業', 'Graduate',
 '', '', '2019-01-01', '2019-12-31', false, null, 300, true),

('11000000-0000-4000-8000-000000000032', 'award',
 'CCEF 華視全方位主持人訓練班 第 53 屆', 'CCEF CTS All-round Host Training Program, 53rd cohort',
 '畢業生', 'Graduate',
 '', '', '2019-01-01', '2019-12-31', false, null, 310, true)   -- 【請確認】年份
on conflict (id) do nothing;

-- -------------------------------------------------------------
-- projects（全部 draft；請在後台補齊內容與圖片後發布）
-- -------------------------------------------------------------
insert into public.projects (id, slug, title_zh, title_en, summary_zh, summary_en,
  problem_zh, problem_en, solution_zh, solution_en, outcome_zh, outcome_en, contribution_zh, contribution_en,
  role_zh, role_en, team_size, period_start, period_end, tech_stack, tags, status, is_featured, sort_order)
values
('12000000-0000-4000-8000-000000000001', 'rules-mcp-server',
 'Rules MCP Server：保險理賠規則自動結構化', 'Rules MCP Server: structuring insurance claim rules',
 '把自然語言的理賠規則自動轉成可驗證的結構化 JSON，讓規則上線與維護更快。',
 'Turns natural-language claim rules into validated, structured JSON so rules ship and change faster.',
 '保險理賠規則以自然語言撰寫，轉成系統可執行的格式仰賴人工，上線慢、維護成本高。',
 'Claim rules are written in natural language; turning them into an executable format was manual, slow to ship and costly to maintain.',
 '以 Spring Boot 實作 MCP Server，設計可擴展的架構，串起規則推薦、生成與驗證的完整流程。',
 'Implemented an MCP Server in Spring Boot with an extensible architecture covering the full recommend → generate → validate workflow.',
 '【請補充】上線的規則數、節省的時間或人力。',
 '[To fill in] number of rules onboarded, time or effort saved.',
 '實習期間負責 MCP Server 的架構設計與主要開發。',
 'Owned the MCP Server architecture and core implementation during the internship.',
 '後端／AI 工程實習生', 'Backend / AI engineering intern', null, '2026-02-01', null,
 '{Java,"Spring Boot","Model Context Protocol",LLM}', '{tool,data-ai}', 'draft', true, 10),

('12000000-0000-4000-8000-000000000002', 'health-qa-rag',
 '繁中健康問答系統：Fine-tuned LLM + RAG', 'Traditional-Chinese health Q&A with a fine-tuned LLM and RAG',
 '為月流量千萬的早安健康打造問答系統，讓用戶一句話得到整合答案，而不是翻好幾篇文章。',
 'A Q&A system for EDH (10M+ monthly visits) that gives one integrated answer instead of a pile of articles.',
 '用戶在早安健康需要搜尋並閱讀多篇文章才能拼湊出答案，平均停留 8.4 分鐘仍未必找到重點。',
 'Readers on EDH had to search and read several articles to piece together an answer.',
 '以 fine-tuned LLM 搭配 RAG 檢索站內內容，生成有來源依據的繁體中文回答。',
 'Fine-tuned an LLM and paired it with RAG over the site''s own content to generate grounded Traditional-Chinese answers.',
 '【請補充】回答準確率、延遲或使用者回饋。',
 '[To fill in] answer accuracy, latency or user feedback.',
 '負責資料管線、檢索與生成流程的設計與實作。',
 'Designed and implemented the data pipeline, retrieval and generation flow.',
 'AI 工程實習生', 'AI engineering intern', null, '2026-02-01', null,
 '{Python,LLM,RAG,"Vector search"}', '{data-ai}', 'draft', true, 20),

('12000000-0000-4000-8000-000000000003', 'parkinson-multimodal-detection',
 '帕金森氏症早期偵測：多模態 AI 模型', 'Early-stage Parkinson''s detection with a multimodal AI model',
 '與台大醫院神經外科合作的碩士研究，結合多種模態資料建立早期偵測模型。',
 'Graduate research with NTUH Neurosurgery combining multiple data modalities for early detection.',
 '帕金森氏症早期症狀細微，單一資料來源難以可靠偵測。',
 'Early Parkinson''s symptoms are subtle and hard to detect reliably from a single data source.',
 '整合多模態資料，訓練深度學習模型並評估其早期偵測能力。',
 'Integrated multimodal data and trained deep-learning models, evaluating their early-detection performance.',
 '【請補充】模型指標（AUC、敏感度等）。',
 '[To fill in] model metrics (AUC, sensitivity, etc.).',
 '主要研究者：資料處理、模型設計、訓練與評估。',
 'Lead researcher: data processing, model design, training and evaluation.',
 '碩士研究生', 'Graduate researcher', null, '2024-09-01', null,
 '{Python,PyTorch,"Deep learning","Multimodal learning"}', '{data-ai}', 'draft', true, 30),

('12000000-0000-4000-8000-000000000004', 'taipei-rental-market',
 '台北租屋市場資料科學系統', 'Taipei rental market data-science system',
 '以機器學習模型預測台北租金分布的資料科學專案。',
 'A data-science project predicting Taipei rent distributions with machine-learning models.',
 '租屋市場資訊分散，租金合理區間不易判斷。',
 'Rental information is scattered and fair price ranges are hard to judge.',
 '收集與清理租屋資料，建立特徵並訓練模型預測租金分布。',
 'Collected and cleaned rental data, engineered features and trained models to predict rent distributions.',
 '【請補充】模型誤差、資料量。',
 '[To fill in] model error, dataset size.',
 '【請補充】', '[To fill in]',
 '資料科學', 'Data science', null, '2024-09-01', '2025-06-30',
 '{Python,pandas,scikit-learn}', '{data-ai}', 'draft', false, 40),

('12000000-0000-4000-8000-000000000005', 'infintas-aiot-assistant',
 'Infintas：AIoT 語音控制助理', 'Infintas: AIoT voice-controlled assistant',
 '2025 Epoch School YEFer 創業計畫中擔任 CTO 開發的 AIoT 語音助理。',
 'An AIoT voice assistant built as CTO of the Infintas team in the 2025 Epoch School YEFer program.',
 '【請補充】', '[To fill in]', '【請補充】', '[To fill in]', '【請補充】', '[To fill in]',
 '技術長：技術架構與開發。', 'CTO: technical architecture and development.',
 'CTO', 'CTO', null, '2025-01-01', '2025-12-31',
 '{IoT,"Speech recognition",LLM}', '{tool}', 'draft', false, 50),

('12000000-0000-4000-8000-000000000006', 'personal-site',
 '個人網站：Next.js + Supabase 雙語作品集', 'Personal site: bilingual portfolio on Next.js and Supabase',
 '這個網站本身：雙語內容、後台管理、AI 翻譯、聯絡表單與排程發布。',
 'This very site: bilingual content, an admin backend, AI translation, a contact form and scheduled publishing.',
 '需要一個能長期維護、雙語且自己能更新的作品集，而不是靜態頁面。',
 'Needed a maintainable bilingual portfolio I can update myself rather than a static page.',
 'Next.js 15 App Router 與 Supabase（Postgres、Auth、Storage），後台以 Supabase Auth 保護，內容以 Claude API 產生翻譯草稿。',
 'Next.js 15 App Router with Supabase (Postgres, Auth, Storage); the admin is protected by Supabase Auth and Claude API drafts translations.',
 'Lighthouse 行動版 Performance 96、Accessibility 100；16 組語言×主題×頁面 axe 無違規。',
 'Lighthouse mobile: Performance 96, Accessibility 100; zero axe violations across 16 locale × theme × page combinations.',
 '獨立設計與開發。', 'Designed and built independently.',
 '全端', 'Full stack', 1, '2026-09-01', null,
 '{TypeScript,"Next.js",React,"Tailwind CSS",Supabase,PostgreSQL,Vercel}', '{web}', 'draft', false, 60)
on conflict (id) do nothing;

commit;
