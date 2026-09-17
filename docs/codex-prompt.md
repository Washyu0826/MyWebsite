# 給 Codex 的開發 Prompt

使用方式：
1. 先把 `personal-site-spec.md` 與 `supabase-schema.sql` 放進專案根目錄的 `docs/`。
2. 每個階段開一個新的 Codex 工作階段，貼上「主 Prompt」+ 該階段的 Prompt。
3. 一次只做一個階段，做完驗收再往下。不要一次貼全部。

---

## 主 Prompt（每個階段都先貼這段）

```
你是資深前端工程師，正在為一位即將畢業的軟體／資料工程學生建立個人網站，主要用途是面試時展示經歷與作品集。

專案規格書在 docs/personal-site-spec.md，資料庫 schema 在 docs/supabase-schema.sql。動手前先完整讀過這兩份文件，並嚴格遵守。

技術棧（不可替換）：
- Next.js 15 App Router + TypeScript（strict 模式）
- Tailwind CSS v4（設計 token 定義在 @theme）
- shadcn/ui（只安裝實際用到的元件）
- Supabase（Postgres + Auth + Storage）
- next-intl 雙語路由（zh / en）
- next-themes 主題切換
- motion（Framer Motion）僅用於首頁揭幕動畫與頁面轉場
- 部署目標：Vercel

硬性規範：
1. 手機優先。所有版面先在 375px 寬做對，再往上擴展。觸控目標最小 44×44px。
2. 無障礙達 WCAG 2.1 AA：焦點可見（2px 靛藍外框 + 2px offset）、鍵盤可完整操作、正確的語意標籤、圖片有 alt、表單 label 綁定、html lang 隨 locale 切換、提供 skip-to-content。
3. 尊重 prefers-reduced-motion，開啟時關閉所有動畫。
4. 顏色只能用 CSS 變數 token（--paper / --ink / --graphite / --rule / --ash / --indigo），禁止在元件內寫死 hex 或用 Tailwind 預設色階。
5. 資料抓取一律在 Server Component 進行，搭配 unstable_cache 與 revalidateTag。Client Component 只在需要互動時使用，並標註 "use client"。
6. SUPABASE_SERVICE_ROLE_KEY 絕對不可出現在任何 client bundle。
7. 不要使用規格書 §1.2 列出的設計反模式：卡片網格作品集、全大寫小標籤、每區塊 fade-up、按鈕文字後加箭頭、中間點串接的 meta、漸層裝飾。
8. 所有面向使用者的文字都要放進 i18n 訊息檔，不可硬編碼在元件中。
9. 每個檔案控制在 200 行以內，超過就拆分。

完成後請回報：做了哪些檔案、還有哪些待辦、以及我需要手動設定的東西（環境變數、外部服務）。
```

---

## Phase 1 — MVP 前台（最優先）

```
執行 Phase 1：把前台做到可以上線，內容先用 Supabase 的 seed 假資料。

任務：
1. 初始化專案
   - create-next-app（TypeScript、App Router、Tailwind、src 目錄、@/* alias）
   - 安裝並設定 shadcn/ui、next-intl、next-themes、motion、@supabase/ssr、react-markdown、remark-gfm
   - 建立 .env.example，列出規格書 §7 的所有變數

2. 設計系統（src/app/globals.css）
   - 依規格書 §1.3 定義 light/dark 兩組 CSS 變數
   - 依 §1.4 設定 Inter + Noto Sans TC + JetBrains Mono（next/font，含 display: swap）
   - 依 §1.4 的類型尺度建立 Tailwind @theme token 與 .prose 排版樣式
   - 中文段落 line-height 1.85、letter-spacing 0.015em；正文最大寬 68ch
   - next-themes 預設 system，加入防閃爍的 inline script

3. i18n
   - next-intl 設定 /[locale] 路由，locale = 'zh' | 'en'，預設 zh
   - 根路徑依 Accept-Language 重導向
   - messages/zh.json 與 messages/en.json
   - 語言切換器要保留當前路徑（/zh/projects/x ↔ /en/projects/x）

4. 版面
   - Header：品牌名 + 導覽 + 語言切換 + 主題切換。手機為全螢幕漢堡選單
   - Footer：社群連結 + 版權
   - Container 元件：max-width 1080px，padding 依 §1.5

5. Supabase 資料層（src/lib/db/）
   - server client（anon key）與 admin client（service role，僅伺服器端）
   - 型別由 supabase gen types 產生，放 src/types/database.ts
   - 實作規格書 §6.1 的所有讀取函式，包在 unstable_cache 並標上對應 tag
   - pickLocale(row, locale) 工具：英文欄位為空時 fallback 中文

6. 頁面
   - /[locale] About 首頁：依 §3.1、§3.2 線框圖。含首頁揭幕動畫（clip-path 由下往上，stagger 0.08s，每個 session 只播一次，用 sessionStorage 判斷）
   - /[locale]/projects：分隔線列表 + 標籤篩選（用 URL searchParams，不用 client state）
   - /[locale]/projects/[slug]：依 §3.4 線框圖，桌機左側 sticky meta 欄，手機摺疊成欄位表。截圖可點開 lightbox
   - /[locale]/contact：先只做聯絡資訊與社群連結，表單留到 Phase 3
   - 404 頁

7. 履歷下載：從 profile.resume_zh_url / resume_en_url 取，按鈕依當前語言給對應檔案

8. 部署：加上 vercel.json，README 寫清楚部署與環境變數設定步驟

不要做：後台、聯絡表單寄信、Blog、排程發布、AI 翻譯。

驗收標準：
- 手機 Lighthouse：Performance ≥ 95、Accessibility 100、Best Practices ≥ 95、SEO ≥ 95
- 兩種語言、兩種主題共 4 種組合皆正常
- 鍵盤可完整操作全站，焦點一律可見
- 375px 寬無任何橫向捲動
```

---

## Phase 2 — 後台

```
執行 Phase 2：建立單一管理員的內容管理後台。

1. 驗證
   - Supabase Auth email + password
   - /admin/login 登入頁
   - middleware.ts 保護 /admin/*：無 session 導向登入頁；session email 不等於 ADMIN_EMAIL 回 403
   - 所有 /admin 回應帶 X-Robots-Tag: noindex, nofollow
   - 後台介面只做中文，不需要 i18n

2. 後台版面
   - 側邊或頂部導覽：專案 / 文章 / 個人資料 / 經歷 / 技能 / 圖片 / 訊息
   - 沿用前台設計 token，但允許使用 shadcn 的 dialog、dropdown、toast

3. 專案管理（核心）
   - /admin/projects 列表：可拖曳排序（dnd-kit）、狀態標記、快速切換發布狀態
   - /admin/projects/[id] 編輯頁，依規格書 §3.6 線框圖：
     * 中文 / English 兩個分頁，共用欄位放在分頁下方
     * Markdown 欄位用「編輯 / 預覽」切換，預覽元件與前台渲染共用
     * slug 由中文標題自動產生但可手動改，需檢查唯一性
     * 技術標籤用 tag input
     * 量化成果可動態新增刪除
     * 截圖上傳支援拖放與排序，每張可填雙語 alt
   - 未儲存時離開頁面要提示

4. 圖片上傳
   - POST /api/admin/upload：驗證 session、檢查 MIME 白名單與 8MB 上限
   - 上傳到 Supabase Storage 的 media bucket，寫一筆 media_assets
   - 回傳公開 URL、寬高

5. 其他管理頁
   - /admin/profile：個人資料 + 社群連結（可排序）+ 履歷 PDF 上傳更換
   - /admin/experience：經歷 CRUD，可排序，區分 work / education / award / activity
   - /admin/skills：技能 CRUD，依分類分組排序
   - /admin/media：圖片庫，可編輯 alt、刪除

6. Server Actions
   - 放在 src/app/admin/_actions/
   - 每個 action：zod 驗證 → 檢查 session → 用 admin client 寫入 → revalidateTag → 回傳 { ok, error? }
   - 用 useActionState + toast 呈現結果

驗收標準：
- 完全不碰程式碼就能新增一個專案、上傳三張截圖、填完雙語內容並發布
- 未登入無法存取任何 /admin 路徑或 admin API
- service role key 不存在於任何 client bundle（用 next build 後搜尋確認）
```

---

## Phase 3 — Blog、排程發布、聯絡表單、AI 翻譯

```
執行 Phase 3。

1. Blog 前台
   - /[locale]/blog 列表（分隔線列，含日期與閱讀時間）
   - /[locale]/blog/[slug] 內頁，Markdown 渲染，程式碼用 rehype 語法高亮（shiki，主題需隨深淺色切換）
   - 標籤篩選
   - site_settings.nav.showBlog 為 false 時，導覽列隱藏 Blog（但路由仍可訪問）
   - /admin/posts 文章管理，沿用專案編輯器的模式

2. 排程發布
   - 內容狀態機：draft → scheduled → published，另有 archived
   - 編輯頁的發布設定：草稿 / 排程（日期時間選擇器）/ 立即發布
   - POST /api/cron/publish：驗證 Authorization Bearer CRON_SECRET，呼叫 publish_due_content()，對回傳的每筆 slug 執行 revalidateTag
   - vercel.json 加入 cron：每 10 分鐘一次
   - 草稿預覽：/api/preview/[type]/[slug]，需 admin session

3. 聯絡表單
   - /[locale]/contact 加上表單（react-hook-form + zod）
   - POST /api/contact：honeypot 欄位、同 ip_hash 每小時上限 5 次（用 contact_rate_limit 表）、存進 messages、用 Resend 寄通知信給 CONTACT_TO_EMAIL
   - 成功與失敗都要有明確的畫面回饋，錯誤訊息要說明怎麼修正
   - /admin/messages 訊息匣：已讀標記、刪除

4. AI 翻譯草稿
   - POST /api/admin/translate：驗證 session，用 Google Cloud Translation API v2
   - 輸入 { fields: Record<string, string>, from: 'zh-TW', to: 'en' }，批次翻譯後回傳同結構
   - 編輯頁按鈕「用 AI 從中文產生英文草稿」：翻譯結果只填入英文分頁的表單欄位，絕不自動儲存
   - 欄位旁顯示「AI 草稿，尚未校閱」標記，使用者手動編輯該欄位後清除標記

驗收標準：
- 設定一則 10 分鐘後發布的文章，時間到會自動出現在前台
- 聯絡表單能成功寄信，且連續送出第 6 次會被擋下
- AI 翻譯能一鍵填滿英文分頁，且不會覆蓋已存檔內容
```

---

## Phase 4 — SEO、分析、打磨

```
執行 Phase 4。

1. SEO
   - 每個頁面實作 generateMetadata：title、description、canonical、openGraph、twitter
   - alternates.languages 正確設定 zh / en 互指 + x-default
   - JSON-LD：首頁 Person + ProfilePage、專案頁 CreativeWork、文章頁 BlogPosting、全站 BreadcrumbList
   - app/sitemap.ts 動態產生所有已發布頁面 × 兩語言
   - app/robots.ts：禁止 /admin 與 /api
   - app/rss.xml/route.ts：文章 RSS

2. 動態 OG 圖
   - /api/og 用 next/og ImageResponse 產生 1200×630
   - 版面：深色底、左對齊白色標題、下方靛藍細線與網站名，不加漸層或裝飾
   - 支援 title、subtitle、kind 參數，字體用 Inter 與 Noto Sans TC（需 fetch 字體檔）

3. 分析
   - GA4 用 @next/third-parties/google，僅在 production 載入
   - 加入 @vercel/speed-insights

4. 打磨
   - 所有列表的空狀態文案要是行動邀請，不只是「沒有資料」
   - 載入狀態用 loading.tsx 與骨架屏，不用 spinner
   - error.tsx 與 not-found.tsx
   - 圖片全部經過 next/image，設定正確的 sizes，封面圖加 priority
   - 執行 npx @axe-core/cli 檢查無障礙問題並修正
   - 最終跑一次 Lighthouse，把行動版分數貼在 README

驗收標準：
- 用 Google Rich Results Test 驗證結構化資料無錯誤
- 分享到 LinkedIn / X 時 OG 圖正確顯示
- axe 掃描零 critical、零 serious 問題
```

---

## 附：常見追加需求（之後想到再用）

```
- 深色模式下的程式碼高亮主題切換
- 專案頁加上「相關專案」推薦
- 履歷頁改成線上版並支援列印樣式（@media print）
- 加上 og:image 針對每個專案使用其封面圖
- 後台加上內容變更歷史紀錄
- 加上 Umami 或 Plausible 作為 GA4 的隱私友善備選
```
