# 實作進度

原始三份文件（`personal-site-spec.md`、`codex-prompt.md`、README）已完整閱讀並保留於 `docs/`。2026-09-18 完成全站稽核與修正，範圍涵蓋 Phase 1 至 Phase 4 的主要項目；下列「驗證紀錄」需在修正合併後重新執行。

## 已完成

### 前台

- Next.js 15.5、React 19、TypeScript strict、Tailwind v4、next-intl、next-themes、Motion、Supabase client。
- 雙語 About／作品列表／案例頁／文章列表（分頁）／文章頁／聯絡頁與 404。
- 分隔線作品列表、固定 meta 欄、URL 標籤篩選、手機選單、圖片 lightbox、Email 複製、履歷語言路由（非法檔名回 404）。
- 預設深色主題（可切換淺色／跟隨系統）、Inter、Noto Sans TC、JetBrains Mono，雙主題色彩與排版 token，SVG logo。
- 聯絡表單：Resend 寄信、寫入 `messages`、honeypot、`contact_rate_limit_hit()` 速率限制。
- 動態 OG 圖片、sitemap／robots、Vercel Analytics 與 Speed Insights。

### 後台與基礎設施

- `/admin/login` Supabase Auth 登入，`ADMIN_EMAIL` 白名單；未登入導向登入頁；`ADMIN_TOKEN` 已移除。
- `/admin/files`（Storage 管理、大頭照）、`/admin/resume`、`/admin/articles`（編輯、狀態機、Claude API 翻譯草稿）。上傳 MIME 白名單不含 SVG。
- `GET /api/cron/publish`：`CRON_SECRET` 驗證、`publish_due_content()`、`revalidateTag()`；`vercel.json` 每小時排程。
- Supabase CLI migration（`supabase/migrations/`）：可重複執行的 schema、bucket、RLS、`publish_due_content()`、`contact_rate_limit_hit()`；根目錄與 `docs/` 的舊 schema 已移除。
- `DEMO_MODE=true` 在正式部署被忽略並記錄一次警告。
- 安全性 header：`X-Frame-Options`、`frame-ancestors 'none'`、`Permissions-Policy`；`NEXT_PUBLIC_SUPABASE_URL` 格式錯誤時給出明確訊息。
- GitHub Actions CI（typecheck、lint、unit、build、Playwright Chromium）。
- `.env.example` 更新：新增 `ANTHROPIC_API_KEY`、`CONTACT_HASH_SALT`，移除 `ADMIN_TOKEN`、`GOOGLE_TRANSLATE_API_KEY`、`NEXT_PUBLIC_GA_ID`。

## 2026-09-18 稽核修正類別

1. 安全：後台改用 Supabase Auth 與 Email 白名單、上傳 MIME／檔名硬化、禁止 SVG、Cron 驗證、聯絡表單速率限制與 IP 雜湊、frame／permissions header、正式環境拒絕示範內容。
2. 資料庫：schema 拆成冪等 migration、bucket MIME 同步、`security definer` 函式收回 anon／authenticated 執行權限。
3. 功能補完：文章 i18n／CSS／分頁、排程發布路由、聯絡表單、OG 圖片、Analytics、logo。
4. 後台：文章編輯器與 AI 翻譯。
5. 工程：CI、Playwright 在 CI 改用 Chromium、稽核腳本改用 `127.0.0.1` 與隨機 debug port、Lighthouse 分數 null 防護。
6. 文件：README、`.env.example`、本檔與開發紀錄更新。

## 驗證紀錄

以下為 2026-09-18 修正合併後的實際執行結果。

- TypeScript：通過（`tsc --noEmit` 0 錯誤）。
- ESLint：通過，0 errors / 0 warnings。
- 單元測試：20 項通過（`tests/content.test.ts` 5、`tests/admin.test.ts` 6、`tests/frontend.test.ts` 5、`tests/ai.test.ts` 4）。
- npm audit：0 vulnerabilities（安裝 @anthropic-ai/sdk、@vercel/analytics、@vercel/speed-insights、resend 後）。
- Production build：通過，`DEMO_MODE=true` 下產生 20 個靜態頁面（中英首頁／作品列表／文章列表／聯絡頁與 8 個案例頁），admin／api／OG 圖為動態路由。
- Playwright：24 項全部通過（Chrome，2026-09-18；測試矩陣新增：文章頁標題與導覽、後台登入導向、`/resume/xx.pdf` 404、聯絡表單存在；淺色主題改由主題選單切換）。
- axe：16 組「語言 × 主題 × 頁面」WCAG A／AA 掃描無違規（包含在 Playwright 矩陣中）。
- Lighthouse 行動版：本次未重跑（上次 2026-09-13：Performance 96、Accessibility 100、Best Practices 100、SEO 63，SEO 扣分為示範模式的 `noindex`）。
- Supabase migration：已靜態檢查冪等性，尚未在實際資料庫執行 `supabase db push`。

歷史紀錄（2026-09-13 Phase 1）：TypeScript／ESLint 通過、單元測試 4 項通過、20 項瀏覽器案例通過、16 組語言×主題×頁面 axe 無違規、FCP 約 1.4 秒、LCP 約 2.5 秒、TBT 約 110ms。

## 需要外部設定才能驗證

- 在實際 Supabase 專案執行 `supabase db push`，並實測 RLS、Storage、`publish_due_content()`、`contact_rate_limit_hit()`。
- 在 Supabase Auth 建立 `ADMIN_EMAIL` 帳號並實測登入／登出。
- 真實資料庫的 `npm run db:types`。
- Resend 網域驗證與實際寄信；Vercel Cron 實際觸發（Hobby 方案每日一次）。
- Vercel 部署、正式網域與正式站 Lighthouse。

## 文件中留待後續處理的差異

- 規格將 Vercel Cron 寫成每 10 分鐘 POST；實作採 Vercel 目前的 GET + Bearer header，排程每小時（Hobby 方案需改每日）。
- 公開 Storage bucket 不會隨草稿 RLS 隱藏已知 URL；若需要保密草稿媒體，應區分私有草稿與公開資產。
- `public/resumes/*.pdf` 為刻意公開的靜態檔案（使用者決定）。
- 首頁版型為左對齊索引，不使用卡片網格、漸層與捲動進場動畫。
- `scripts/generate-seed.ts` 重新產生 `supabase/seed.sql` 時，需保留手動加入的 `social_links` 示範列（`where not exists`）。
