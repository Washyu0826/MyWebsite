# Hsien 個人網站

依 `personal-site-spec.md` 與 `codex-prompt.md` 建立的 Phase 1 前台。使用 Next.js 15 App Router、TypeScript strict、Tailwind CSS v4、shadcn 風格 Button / Radix Dialog、next-intl、next-themes、Motion 與 Supabase。

## 本機啟動

需要 Node.js 22 以上。

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

開啟 [中文首頁](http://localhost:3000/zh) 或 [英文首頁](http://localhost:3000/en)。根路徑會依語言偏好導向中／英文；手動切換語言後會保留偏好與目前路徑、篩選條件。

本次 Windows 環境使用 Node.js 24，下載依賴時需信任系統憑證。若在相同環境遇到 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`，可在安裝／建置前執行 `$env:NODE_OPTIONS='--use-system-ca'`，保留 TLS 驗證。

`.env.example` 預設 `DEMO_MODE=true`，能在沒有外部帳號時預覽完整前台。專案、經歷與技能都是示範內容，頁面會顯示提示，並設定 `noindex`。未提供 PDF 時，履歷區域顯示準備中；不會製造假的履歷檔案或錯誤下載連結。

## 目前功能

- `/zh`、`/en`：個人簡介、精選作品、經歷、分類技能與聯絡邀請。
- `/{locale}/projects`：分隔線作品列表，使用 URL 的 `tag` 參數篩選。
- `/{locale}/projects/{slug}`：案例研究、固定資訊欄、技術架構與圖片放大、前後專案。
- `/{locale}/contact`：Email、複製回饋、社群與履歷入口。
- `/resume/{locale}.pdf`：導向該語言的 Storage 履歷；不存在時導向聯絡頁。
- 系統／淺色／深色主題、全螢幕手機選單、焦點管理、減少動態效果、404 與錯誤狀態。
- Server Component 資料查詢、帶標籤的快取、發布條件篩選，以及為後续 Blog 保留的查詢函式。

本次遵照文件一次一階段的要求。後台、Blog 介面、寄信表單、排程與 AI 翻譯尚未實作。

## Supabase 設定

1. 建立 Supabase 專案，在 SQL Editor 執行 [原始 schema](docs/supabase-schema.sql)。它包含表格、RLS、Storage bucket 和基本 profile seed。**這是首次初始化腳本，trigger / policy 並非可重複執行的 migration。請勿在已有資料庫盲目重跑。**
2. 若要預覽完整內容，可在開發資料庫執行 [supabase/seed.sql](supabase/seed.sql)。固定 UUID 與 `on conflict do nothing` 避免重複插入，profile 只在空白或原始 placeholder 狀態更新。它仍是示範資料，請先替換真實內容再正式發布。
3. 在 `.env.local` 設定 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`，並設 `DEMO_MODE=false`。
4. 上傳中英 PDF 至公開 `resume` bucket，把公開網址寫入 `profile.resume_zh_url`、`resume_en_url`。不會用另一語言的 PDF 自動替代。
5. 在 Supabase Auth 建管理員帳號可留到 Phase 2；目前不需要 service role key 即可讀取前台。

公開查詢只使用 anon client，與登入 cookie 隔離。快取標籤為 `profile`、`experience`、`skills`、`projects`、`project:{slug}`、`posts`、`post:{slug}`，300 秒更新一次。後台加入後，寫入需呼叫 `revalidateTag()`；目前可等待快取到期或重新部署。

`src/lib/db/admin.ts` 使用 `server-only` 防止誤匯入 client bundle。不要為 service role key 加上 `NEXT_PUBLIC_`。

### 資料庫型別

目前 [src/types/database.ts](src/types/database.ts) 是依提供的 SQL 整理的**暫用公開讀取型別**，不是從真實資料庫生成；寫入型別刻意停用。取得專案後請執行：

```powershell
npx supabase login
# 在 .env.local 設定 SUPABASE_PROJECT_ID
npm run db:types
npm run typecheck
```

指令會從 Supabase 產生型別，只有成功才覆寫檔案。CLI 登入與專案建立需使用自己的帳號。

## 環境變數

完整清單見 [.env.example](.env.example)。

| 變數 | 使用時機 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 正式網站的完整 HTTPS 網址，供 metadata 使用 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 真實內容模式必填 |
| `DEMO_MODE` | 本機示範填 `true`；使用真實內容填 `false` |
| `SUPABASE_PROJECT_ID` | 只供型別生成腳本使用 |
| `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_EMAIL` | Phase 2 後台使用 |
| `RESEND_API_KEY` / `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL` | Phase 3 聯絡表單使用 |
| `GOOGLE_TRANSLATE_API_KEY` / `CRON_SECRET` | Phase 3 翻譯與排程使用 |
| `NEXT_PUBLIC_GA_ID` | Phase 4 分析使用，目前不載入追蹤碼 |

正式建置若沒有資料庫設定，必須明確指定 `DEMO_MODE=true` 才能使用示範內容；資料庫錯誤不會偷偷改用假資料。

## Vercel 部署

1. 將專案推送到自己的 Git repository，在 Vercel 匯入，Framework 選 Next.js。
2. 設定 Node.js 22 或更新版本、Build Command `npm run build`，輸出目錄保留預設。
3. Preview 環境可設 `DEMO_MODE=true`。Production 應設定網站網址、Supabase 公開連線資訊，並在換好真實內容後設 `DEMO_MODE=false`。
4. 部署後測試兩語言、兩主題、真實履歷與圖片。`next/image` 只允許設定的 Supabase 主機與公開 Storage 路徑，若使用其他圖片主機需調整 `next.config.ts`。
5. 到 Vercel 的 Domains 加入已購買的網域，依該專案目前顯示的 DNS 記錄設定，完成 HTTPS 驗證。

尚未替你建立遠端 Supabase／Vercel 專案或購買網域。

## 驗證

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

啟動 `npm run start` 後，可另執行 `npm run audit:site`。它會以背景 Chrome 產生桌機／手機截圖與 Lighthouse 行動版 HTML、JSON 報告，放在 `artifacts/`。示範模式刻意禁止索引，因此 SEO 分數會受 `noindex` 影響；正式內容上線後需再次量測。

正式建置前需先有 `.env.local` 或對應環境變數。Playwright 預設使用已安裝的 Google Chrome；其他環境可調整 `playwright.config.ts` 的 channel 或安裝 Chromium。E2E 使用 production server，應以示範內容建置後執行。

測試涵蓋雙語空值回退、履歷語言、連結協定、翻譯鍵一致性，以及手機版四種語言／主題組合的 axe 掃描、URL 篩選、鍵盤焦點、圖片放大、404 與語言導向。實際執行結果會記錄在 [docs/implementation-status.md](docs/implementation-status.md)。

2026-09-13，本機 production build 的 Lighthouse 行動版實測：

| Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | --- |
| 96 | 100 | 100 | 63 |

SEO 唯一扣分為示範模式刻意設定的 `noindex`。LCP 約 2.5 秒，尚未達規格的 2 秒進階目標；正式網域、真實內容及實際主機仍需重新驗收。報告與截圖可在 [artifacts/](artifacts/) 查看，或使用 `npm run audit:site` 重現。

## 檔案導覽

| 路徑 | 內容 |
| --- | --- |
| `src/app/[locale]` | 前台路由與頁面 |
| `src/components` | 版面、互動與案例元件 |
| `src/app/globals.css` / `src/styles` | 雙主題 token、排版與版面 |
| `messages` | 中英介面文案 |
| `src/lib/db` | 伺服器端公開查詢與 client |
| `src/lib/demo` | 明確標示的示範內容 |
| `supabase/seed.sql` | 由示範內容產生的可重複匯入 SQL |
| `tests` | 單元測試與瀏覽器驗證 |
| `docs` | 原始文件副本、進度與待辦 |

更新示範內容後可用 `node --import tsx scripts/generate-seed.ts` 重新產生 SQL。

技術參考：[next-intl 路由設定](https://next-intl.dev/docs/routing/setup)、[Supabase 型別生成](https://supabase.com/docs/guides/api/rest/generating-types)、[Next.js 15.5](https://nextjs.org/blog/next-15-5)。
