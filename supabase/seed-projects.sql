-- =============================================================
-- 專案案例內容（2026-09-20）
--
-- 執行：npm run db:seed:projects   （或貼進 Supabase SQL Editor）
-- 可重複執行；只更新 projects 既有的六列，不新增也不刪除。
--
-- 內容來源全部是 2026-04 版中英履歷所寫的事實。凡是履歷沒有寫、
-- 只有本人知道的量化成果，一律留空（outcome_* = ''），空的段落在
-- 前台不會渲染。請依 docs/project-content-checklist.md 補完再發布。
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. Rules MCP Server（國泰金控）
-- -------------------------------------------------------------
update public.projects set
  summary_zh = '讓理賠規則從一句中文，變成可被驗證、可被執行的結構化資料。',
  summary_en = 'Turns a claim rule written in plain Chinese into structured data that can be validated and executed.',
  problem_zh = '保險理賠規則是由熟悉法規與商品的同仁以自然語言寫成的。要讓系統真的照著跑，必須有人把每一條規則翻譯成程式看得懂的結構，這一步既慢又容易失真。

更麻煩的是規則會變。商品調整、法規更新、實務上發現例外，都會讓同一條規則重新走一次「讀懂、翻譯、驗證、上線」的循環。翻譯的人力成了規則能多快生效的瓶頸。',
  problem_en = 'Claim rules are written in natural language by the people who know the products and the regulations. Before a system can act on them, someone has to translate each rule into a structure a program can read, which is slow and easy to get subtly wrong.

Rules also change. A product adjustment, a regulatory update or an exception found in practice all send the same rule back through read, translate, validate, ship. The translation step becomes the limit on how fast a rule can take effect.',
  solution_zh = '把「規則的結構化」本身做成一個服務，讓語言模型可以直接呼叫，而不是讓工程師逐條手寫。

服務以 Model Context Protocol 對外提供工具，涵蓋完整流程：**推薦**既有的相似規則供參考、依自然語言**生成**候選的結構化 JSON、再以結構定義**驗證**產出是否合法。三個步驟串成一條可重複執行的管線，每一步的輸出都是下一步的輸入。

架構刻意設計成可擴展：新的規則型態以新增定義的方式接上，不必改動核心流程。',
  solution_en = 'Make the structuring itself a service that a language model can call, instead of having engineers hand-write every rule.

The server exposes its tooling over the Model Context Protocol and covers the whole flow: **recommend** similar existing rules for reference, **generate** a candidate structured JSON from the natural-language text, then **validate** that output against the schema. The three steps form a repeatable pipeline where each output is the next input.

The architecture is deliberately extensible: a new rule type plugs in as a new definition rather than a change to the core flow.',
  body_zh = '### 為什麼是 MCP

理賠規則的結構化不是一次性的轉檔，而是一段需要來回的工作：模型產出一版、驗證器指出哪裡不合法、再修正。把這些能力包成 MCP 工具，等於讓模型自己走完這個迴圈，而不是由人在中間轉手。

### 驗證先於生成

先有明確的結構定義，生成才有意義。驗證不只是檢查欄位型別，更重要的是讓「不合法」變成一個明確、可讀的錯誤訊息，模型才有辦法針對它修正。

### 用 Spring Boot

這是團隊既有的技術棧，也是這個服務未來要落腳的環境。選熟悉的框架讓交接與維護的成本降到最低，而不是為了新穎去挑一個沒人維護得動的東西。',
  body_en = '### Why MCP

Structuring a claim rule is not a one-shot conversion; it is a loop. The model produces a version, the validator says what is wrong, the model corrects. Exposing those capabilities as MCP tools lets the model run that loop itself instead of a person relaying between steps.

### Validation before generation

Generation only means something once the target structure is defined. Validation is not just type checking: its job is to turn "invalid" into a specific, readable message the model can act on.

### Spring Boot

It is the team''s existing stack and the environment this service will live in. Picking the familiar framework keeps handover and maintenance cheap, rather than choosing something novel that nobody left behind can maintain.',
  contribution_zh = '實習期間負責這個服務的架構設計與主要開發，包含 MCP 工具介面的定義、推薦與生成流程的串接，以及結構驗證的實作。',
  contribution_en = 'Owned the architecture and the bulk of the implementation during the internship: defining the MCP tool surface, wiring the recommend and generate flow, and implementing schema validation.',
  outcome_zh = '', outcome_en = '',
  role_zh = '後端與 AI 工程實習生', role_en = 'Backend and AI engineering intern',
  tech_stack = '{Java,"Spring Boot","Model Context Protocol",LLM,JSON Schema}',
  tags = '{tool,data-ai}',
  is_featured = true, sort_order = 10, updated_at = now()
where slug = 'rules-mcp-server';

-- -------------------------------------------------------------
-- 2. 繁中健康問答系統（H2U 永悅健康）
-- -------------------------------------------------------------
update public.projects set
  summary_zh = '把讀者原本要翻好幾篇文章才拼得出來的答案，收斂成一句有依據的回覆。',
  summary_en = 'Collapses an answer that used to take several articles to piece together into one grounded reply.',
  problem_zh = '早安健康累積了大量的健康內容，月流量千萬、讀者平均停留 8.4 分鐘。停留久不一定代表讀得順——很多時候是因為一個問題的答案分散在好幾篇文章裡，讀者得自己搜尋、開好幾個分頁、再把資訊拼起來。

健康問題又特別不能亂答。回答必須有來源、用詞要符合繁體中文的醫療語境，而不是把簡體或英文的說法直接翻過來。',
  problem_en = 'EDH has built up a large library of health content, with over ten million monthly visits and an average session of 8.4 minutes. A long session is not the same as an easy one: often the answer to a single question is spread across several articles, and the reader has to search, open a handful of tabs and assemble it themselves.

Health questions are also the wrong place to guess. An answer has to be traceable to a source, and the wording has to sit properly in Traditional Chinese medical register rather than read as a translation.',
  solution_zh = '以站內既有內容為基礎做檢索增強生成：先把文章切成可追溯的段落並建立索引，使用者提問時檢索出相關段落，再交給經過微調的語言模型整合成一段回答。

微調的重點不是讓模型更聰明，而是讓它的用詞與語氣貼近繁體中文的健康內容，並且學會在沒有把握時不要硬答。回答一律以檢索到的內容為依據，而不是模型自己的記憶。',
  solution_en = 'Retrieval-augmented generation over the site''s own library: articles are split into traceable passages and indexed, a question retrieves the relevant passages, and a fine-tuned model composes them into a single answer.

The point of fine-tuning is not to make the model cleverer but to put its vocabulary and register where Traditional Chinese health content lives, and to teach it not to answer past what it was given. Every answer is grounded in the retrieved passages rather than the model''s own memory.',
  body_zh = '### 檢索的品質決定答案的品質

生成看起來是最顯眼的一步，但真正決定答案好壞的是檢索。切分段落的方式、索引的建立、以及如何在語意相近但主題不同的內容之間分辨，都比換一個更大的模型來得關鍵。

### 繁體中文的難處

健康領域的中文用詞在台灣、中國、香港有明顯差異，通用模型很容易混用。微調的資料集因此以站內的繁中內容為主，讓輸出的語感與原本的文章一致。

### 不知道就說不知道

比答錯更糟的是答得很有自信卻是錯的。系統的設計前提是：檢索不到足夠依據時，寧可回覆找不到，也不要生成看起來合理的內容。',
  body_en = '### Retrieval decides the answer

Generation is the visible step, but retrieval is what determines whether the answer is any good. How passages are split, how they are indexed, and how the system tells apart content that is semantically close but topically different all matter more than reaching for a bigger model.

### What makes Traditional Chinese hard

Health vocabulary differs noticeably between Taiwan, China and Hong Kong, and a general model mixes them freely. The fine-tuning set is therefore drawn from the site''s own Traditional Chinese content, so the output reads like the articles it came from.

### Saying so when it does not know

Worse than a wrong answer is a confident wrong answer. The system is built so that when retrieval does not surface enough support, it says it cannot find one rather than generating something plausible.',
  contribution_zh = '負責資料管線、檢索流程與生成流程的設計與實作，包含內容切分與索引、檢索策略，以及微調資料集的整理。',
  contribution_en = 'Designed and built the data pipeline, the retrieval flow and the generation flow: passage splitting and indexing, the retrieval strategy, and preparing the fine-tuning set.',
  outcome_zh = '', outcome_en = '',
  role_zh = 'AI 工程實習生', role_en = 'AI engineering intern',
  tech_stack = '{Python,LLM,RAG,"Fine-tuning","Vector search"}',
  tags = '{data-ai}',
  is_featured = true, sort_order = 20, updated_at = now()
where slug = 'health-qa-rag';

-- -------------------------------------------------------------
-- 3. 帕金森氏症早期偵測（政大碩士研究 × 台大醫院神經外科）
-- -------------------------------------------------------------
update public.projects set
  summary_zh = '與台大醫院神經外科合作的碩士研究，用多模態模型處理單一訊號看不出來的早期徵兆。',
  summary_en = 'Graduate research with NTUH Neurosurgery on catching early signs that no single signal shows clearly.',
  problem_zh = '帕金森氏症的早期徵兆很細微，而且不會集中在單一種訊號上。臨床上確診時，神經退化往往已經進行了一段時間。

單一模態的模型在這件事上有先天限制：某一種訊號可能在特定病人身上明顯，在另一位身上卻幾乎讀不出來。要提早偵測，需要同時參考多種來源，並處理它們之間不一致的部分。',
  problem_en = 'The early signs of Parkinson''s are subtle, and they do not concentrate in any one kind of signal. By the time a clinical diagnosis is made, the underlying degeneration has usually been running for some time.

A single-modality model is structurally limited here: a signal that is clear in one patient can be almost unreadable in another. Detecting early means drawing on several sources at once, and dealing with the places where they disagree.',
  solution_zh = '建立多模態的深度學習模型，整合不同來源的資料進行早期偵測，並與台大醫院神經外科合作取得臨床上的判讀與回饋。',
  solution_en = 'Build a multimodal deep-learning model that combines several data sources for early detection, developed with NTUH Neurosurgery so the clinical reading and feedback come from practice rather than from the dataset alone.',
  body_zh = '',
  body_en = '',
  contribution_zh = '主要研究者，負責資料處理、模型設計、訓練與評估。',
  contribution_en = 'Lead researcher: data processing, model design, training and evaluation.',
  outcome_zh = '', outcome_en = '',
  role_zh = '碩士研究生', role_en = 'Graduate researcher',
  tech_stack = '{Python,PyTorch,"Deep learning","Multimodal learning"}',
  tags = '{data-ai}',
  is_featured = true, sort_order = 30, updated_at = now()
where slug = 'parkinson-multimodal-detection';

-- -------------------------------------------------------------
-- 4. 台北租屋市場資料科學系統（政大）
-- -------------------------------------------------------------
update public.projects set
  summary_zh = '把分散的租屋資訊整理成可以比較的分布，而不是一筆一筆看價格。',
  summary_en = 'Turns scattered rental listings into a distribution you can compare against, instead of one price at a time.',
  problem_zh = '租屋資訊分散在不同平台，格式與揭露程度都不一致。要判斷一個物件的租金是否合理，通常只能靠翻很多筆相似物件憑印象比較。

同一個區域、同樣的坪數，租金可能因為屋齡、樓層、有無電梯而差很多。缺少一個可以對照的基準，「合理」就只是感覺。',
  problem_en = 'Rental listings are spread across platforms with inconsistent formats and inconsistent disclosure. Judging whether a given rent is reasonable usually means scrolling through many similar listings and forming an impression.

In the same district at the same size, rent can vary widely with building age, floor and whether there is a lift. Without a baseline to compare against, "reasonable" is only a feeling.',
  solution_zh = '建立一套資料科學流程：收集並清理租屋資料、整理出可用的特徵，再以機器學習模型預測租金的分布，讓單一物件可以放回分布中對照。',
  solution_en = 'A data-science pipeline: collect and clean rental data, engineer usable features, then model the rent distribution with machine learning so any single listing can be placed back into that distribution.',
  body_zh = '',
  body_en = '',
  contribution_zh = '',
  contribution_en = '',
  outcome_zh = '', outcome_en = '',
  role_zh = '資料科學', role_en = 'Data science',
  tech_stack = '{Python,pandas,scikit-learn}',
  tags = '{data-ai}',
  is_featured = false, sort_order = 40, updated_at = now()
where slug = 'taipei-rental-market';

-- -------------------------------------------------------------
-- 5. Infintas AIoT 語音控制助理（2025 Epoch School YEFer）
-- -------------------------------------------------------------
update public.projects set
  summary_zh = '在創業計畫中擔任技術長，帶團隊做出語音控制的 AIoT 助理。',
  summary_en = 'Served as CTO on an entrepreneurship programme team building a voice-controlled AIoT assistant.',
  problem_zh = '',
  problem_en = '',
  solution_zh = '',
  solution_en = '',
  body_zh = '',
  body_en = '',
  contribution_zh = '擔任 Infintas 團隊技術長，負責技術架構與開發。',
  contribution_en = 'CTO of the Infintas team, responsible for the technical architecture and the build.',
  outcome_zh = '', outcome_en = '',
  role_zh = '技術長', role_en = 'CTO',
  tech_stack = '{IoT,"Speech recognition",LLM}',
  tags = '{tool}',
  is_featured = false, sort_order = 50, updated_at = now()
where slug = 'infintas-aiot-assistant';

-- -------------------------------------------------------------
-- 6. 個人網站（本站）
-- -------------------------------------------------------------
update public.projects set
  summary_zh = '你正在看的這個網站：雙語內容、自建後台、AI 翻譯草稿，以及一個會呼吸的立體派背景。',
  summary_en = 'The site you are reading: bilingual content, a self-built admin, AI translation drafts and a cubist backdrop that breathes.',
  problem_zh = '大部分的作品集只列技術名稱。看的人知道你用過 React，卻不知道你解決了什麼問題、做了哪些取捨、哪一部分真的是你做的。

另一個問題是維護。用靜態檔案寫的作品集，每加一個專案就要改一次程式碼、重新部署一次；久了就不會再更新。',
  problem_en = 'Most portfolios list technologies. A reader learns that you have used React, but not what problem you solved, what you traded away, or which part was actually yours.

The other problem is upkeep. A portfolio written as static files needs a code change and a deploy for every new project, and sooner or later it stops being updated.',
  solution_zh = '以案例研究為結構：每個專案都有問題、解法、架構、我的貢獻與成果五個固定段落，讀者可以快速找到想看的部分。

內容全部存在資料庫裡，透過自建的後台維護，不需要改程式碼。中英雙語各自獨立撰寫，並提供用 Claude API 產生另一語言草稿的功能——產生的是草稿，一律經過人工確認才儲存。',
  solution_en = 'Structured as case studies: every project has the same five sections — problem, approach, architecture, my contribution, outcome — so a reader can jump to what they came for.

All content lives in a database and is maintained through a self-built admin, with no code change required. The two languages are written independently, with a Claude API button that drafts the other language; what it produces is a draft, and nothing is saved without a human reading it first.',
  body_zh = '### 後台的存取控制

後台用 Supabase Auth 登入，並以 Email 白名單授權。驗證同時放在 middleware 與每一個 Server Action 裡——只靠頁面層擋是不夠的，Server Action 可以被直接呼叫。

### 立體派背景

首頁背景是一張 canvas，用固定亂數種子把畫面遞迴切成四十多個切面，再上赭土色系的顏料。它有三層動態：每片切面以二十到四十秒的週期緩慢漂移、一道光帶每二十八秒斜掃過畫面、輔助線以三十四秒的循環反覆畫出再淡去。滑鼠會造成依深度分層的視差。

這些動態都刻意壓得很低——安靜到讀文字時不會分心，但停留幾秒就會發現畫面是活的。啟動延後到瀏覽器空閒才進行，避免和首次繪製搶主執行緒。

### 效能上的取捨

網站原本打包了完整的中文字型，四百多萬位元組。改用系統字型堆疊後省下約 4 MB 字型與 92 KB 的 CSS。過程中也發現一個一直存在的問題：字型變數宣告在 `:root`，但實際的值只存在於 `<body>`，整條宣告因此無效，正式站從來沒有下載過任何字型。

### 無障礙

以 WCAG 2.2 AA 為驗收標準，不只跑自動掃描，也實際走過鍵盤路徑、焦點順序與螢幕閱讀器的公告。最吃緊的是立體派背景上的文字對比，實測後最低的一處仍然通過，但也因此背景的亮度不能再往上調。',
  body_en = '### Access control in the admin

The admin signs in through Supabase Auth and authorises against an email allowlist. The check sits in the middleware **and** inside every server action, because a page-level guard is not enough: server actions can be called directly.

### The cubist backdrop

The homepage background is a canvas. A fixed seed cuts the frame recursively into forty-odd facets which are painted in earth pigments. It carries three layers of motion: each facet drifts on a twenty to forty second cycle, a band of light sweeps diagonally every twenty-eight seconds, and the construction lines redraw themselves on a thirty-four second loop. The pointer produces parallax by facet depth.

All of it is deliberately quiet — still enough to read over, alive enough to notice if you linger. Setup is deferred to the first idle slice so it never competes with the first paint.

### A performance trade

The site used to ship the full Chinese webfont, about four megabytes. Moving to a system font stack saved roughly 4 MB of font and 92 KB of CSS. That work also surfaced a long-standing bug: the font variables were declared on `:root` while their values only existed on `<body>`, which made the whole declaration invalid — the production site had never downloaded a webfont at all.

### Accessibility

Built to WCAG 2.2 AA and verified beyond the automated scan: the keyboard path, focus order and screen-reader announcements were all walked manually. The tightest constraint is text contrast over the cubist backdrop; the worst case measured still passes, which is also why the backdrop cannot be brightened any further.',
  contribution_zh = '獨立設計與開發，從資料庫結構、後台、前台到 CI 與部署。',
  contribution_en = 'Designed and built alone, from the database schema and the admin through the front end to CI and deployment.',
  outcome_zh = 'Lighthouse 在 CI 上四個類別全部 90 以上，無障礙與 SEO 為 100。測試涵蓋 112 項單元測試、65 項元件測試、25 項端對端測試與 16 組視覺回歸比對，全部在每次推送時執行。

改用系統字型堆疊後，首次造訪淨減約 45 KB。axe 在十六組「語言 × 主題 × 頁面」的組合下皆無違規。',
  outcome_en = 'Lighthouse scores 90 or above in all four categories on CI, with accessibility and SEO at 100. The suite covers 112 unit tests, 65 component tests, 25 end-to-end tests and 16 visual regression comparisons, all run on every push.

Moving to a system font stack cut about 45 KB from a first visit on balance. axe reports no violations across sixteen locale, theme and page combinations.',
  role_zh = '全端', role_en = 'Full stack',
  team_size = 1,
  tech_stack = '{TypeScript,"Next.js",React,"Tailwind CSS",Supabase,PostgreSQL,Playwright,Vercel}',
  tags = '{web}',
  is_featured = false, sort_order = 60, updated_at = now()
where slug = 'personal-site';

commit;
