# 素材庫第一階段：啟用與維護

本階段整合 `/admin/files`、照片發布、履歷更新，以及文章／作品編輯器的圖片上傳。不新增 AWS 帳號、付費儲存服務或背景排程。仍使用網站既有的 Next.js、Supabase Auth / Postgres / Storage。

## 已完成的功能

- 私人原始檔與公開副本分開，只有明確發布才產生公開網址。
- PNG、JPEG、WebP、GIF、PDF；單檔上限 **8 MiB**。
- 瀏覽器透過 TUS 直傳 Storage，6 MiB 分段；同頁可暫停、重試，支援最多 20 個檔案的循序上傳。
- 伺服器再次比對實際大小、檔頭格式並計算 SHA-256，通過後才能預覽或發布。
- UUID 儲存鍵與顯示檔名分開，中文檔名不再直接當 Storage key。
- 不覆寫舊版本，可切換目前版本；切換私人版本不會暗中更改已公開的內容。
- 垃圾桶與還原、名稱搜尋、25 筆分頁、操作紀錄、60 秒私人預覽網址。
- 公開圖片沿用 WebP／尺寸／EXIF 處理與圖片 metadata 管線，私人原始檔保留不變。GIF 動畫與缺少編碼器的 fallback 行為沿用既有管線，並非所有格式都保證移除 metadata。
- 同一份已管理的照片／中英文履歷，再次從對應上傳入口更新時，會沿用原素材的版本歷史。
- 更新 profile 前會比較原網址，偵測另一個發布操作的更新，避免舊請求覆蓋新資料。
- 發布中斷後可重試同一操作；已上傳的公開副本先驗證雜湊再沿用，不重複寫入。
- 原本 `media` / `resume` 檔案保留，從「既有公開檔案」唯讀瀏覽；不批次搬動或改寫文章網址。
- **使用位置**：檔案詳情列出每個公開副本被哪裡引用（個人照／履歷欄位、作品封面／架構圖／畫廊／內文、文章封面／內文），可直接連到對應後台頁面。
- **素材選擇器**：作品編輯器的網址欄位與文章封面欄位可「從素材庫選擇」已發布的檔案；圖片可一鍵複製 Markdown 語法貼進內文。
- 上傳與發布的容量預留在 24 小時後自動失效（Supabase 簽名上傳網址只有 2 小時有效），取消或中斷的上傳不再永久占用預算。

## 正式 Supabase 必做

**程式修改不等於資料庫已啟用。本次開發未對正式 Supabase 執行 migration。**

1. 先備份既有資料庫及 Storage 檔案。資料庫匯出不包含 Storage 的實體檔案，兩者需分別保存。
2. 在目前網站使用的 Supabase 專案打開 **SQL Editor**，執行完整的：
   `supabase/migrations/20260920000100_asset_library.sql`。
   這是增量 migration，不是 `seed.sql`。已有網站資料時不需要重跑示範 seed 或初始化 schema。
3. 新 migration 建立 `assets`、`asset_versions`、`asset_publications`、`asset_events`、專用 RPC，以及 **非公開**的 `assets-private` bucket。
   接著執行 `supabase/migrations/20260920000300_asset_references.sql`：它新增 `asset_references()`，並以「仍被引用才擋回收」與「預留 24 小時後失效」取代原本的垃圾桶與容量規則。沒有套用時，檔案詳情會回報素材庫資料庫尚未更新。
4. 檢查原有 `media` 與 `resume` buckets 仍存在、仍是網站原本使用的公開 buckets，且其上限至少為 8 MiB。這兩個 buckets 是既有初始化 migration 建立的，新 migration 不更改它們。
5. 若要保存最佳化圖片的尺寸與模糊預覽資料，也套用專案另外新增的 `20260920000200_media_dimensions.sql`。此表缺少時圖片發布仍可完成，但 metadata 僅為 best effort。
6. 檢查 Storage policies 不存在套用「所有 buckets」的廣泛匿名／authenticated 讀寫權限。新 bucket 不需要新增瀏覽器直接讀寫 policies；伺服器提供短期簽名授權。

如果你一直使用 Supabase CLI 管理 migrations，可先確認 linked project 與 migration history，再使用原本的 `supabase db push` 流程。不要同時混用手動執行與 CLI，而未同步 migration history。

## 環境與登入

本機 `.env.local` 與 Vercel 對應環境皆需要：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_KEY
ADMIN_EMAIL=YOUR_ADMIN_EMAIL
```

不要把 service role key 放進 `NEXT_PUBLIC_*`、Git 或訊息中。本版沿用 Supabase Auth 帳號及 `ADMIN_EMAIL` 白名單，不是舊的 `ADMIN_TOKEN` 登入方式。

本機啟動 `npm run dev`，到 `/admin/login` 登入，再到 `/admin/files`。Vercel 需包含這次程式碼的新部署，且 production 環境變數需設定完成；只重新部署舊 commit 不會包含新功能。

## 使用流程

1. **私人檔案**：素材庫 → 上傳檔案 → 選取 → 上傳。未發布時訪客看不到原始檔。
2. **個人照**：選取圖片 → 用途「個人照」→ 發布；後續版本可在詳情新增再發布。公開 Contact 頁沿用 profile 的照片網址。
3. **履歷**：`/admin/resume` 選語言並上傳；或在素材庫選 PDF，再發布為中文／英文履歷。
4. **文章與作品圖片**：編輯器的「上傳並建立公開網址」會保存私人原始檔並發布圖片，填回 URL；「從素材庫選擇」則挑已發布的檔案填入。內文圖片在選擇器按「Markdown」複製 `![名稱](網址)` 後貼進內文。尚未儲存的文章不會自動儲存；已建立的公開圖片 URL 本身是公開的。
5. **回復版本**：選舊版本 → 設為目前版本。要回復網站照片／履歷，還需把該版本再次發布到對應用途。
6. **傳輸中斷**：同頁按重試；如果 Storage 已收完但網站沒收到結果，可在版本詳情「重試驗證」。重新整理後沒有保留本機 File 物件，未傳完的版本需取消，再選檔新增版本；不是跨瀏覽器／跨裝置續傳。
7. **發生發布衝突**：重新整理確認現在的照片或履歷，再明確重新發布。發生衝突的舊公開副本仍保留，不能假設網址已撤銷。

## 容量與安全界線

- 800 MB 是本功能的軟體預算，不是供應商帳單的硬上限。會計入所有 buckets 的已存檔案與未完成操作的保守預留；不能阻止 Dashboard、其他程式或外部 API 繞過本流程寫入，也不能限制讀取流量。
- 每個待上傳版本／待發布操作預留最多 8 MiB，24 小時內持續計入（簽名上傳網址最長 2 小時有效，留足餘裕），之後只計算實際存在 Storage 的物件。取消或驗證失敗的版本紀錄仍保留，但不再永久占用預算；已上傳但未驗證的物件仍算容量。
- 仍被個人資料、作品或文章引用的素材不能進垃圾桶，詳情會列出引用位置；已發布但沒有任何引用的素材可以回收，公開副本不會被刪除，知道網址的人仍可讀取。引用掃描比對的是本站資料庫裡的公開網址（含 Markdown 內文），不包含站外貼出去的連結。撤銷公開副本留待下一階段。
- 垃圾桶不刪實體檔案，也不自動清空；不會回收容量。
- 已發出的私人預覽網址在最多 60 秒有效期內仍可使用。公開副本即使未被網站引用，知道網址的人仍可讀取。
- SHA-256 用來驗證完整性，不等於自動去重、病毒掃描或 PDF 內容安全掃描。
- audit 表記錄素材狀態轉移，詳情顯示最新 100 筆，全部紀錄可由「操作紀錄」分頁查詢。它不是防竄改的外部稽核服務，service role / 資料庫擁有者仍有寫入權限。
- 簽名 URL 與服務金鑰不寫入事件表。API 錯誤回傳追蹤 ID；未知錯誤不把內部訊息暴露給前端。

## 架構

```text
Admin browser
  -> same-origin JSON API -> requireAdmin / allowlist
  -> Postgres RPC: reserve version + audit + quota under transaction lock
  <- signed upload token for one immutable private object key
  -> TUS directly to private Storage (file body bypasses Vercel)
  -> JSON complete -> server downloads, validates, hashes -> ready version
  -> explicit publish -> optimized public copy -> profile compare-and-set + audit
```

Postgres 與 Storage 不具跨服務交易，所以使用可重試的 pending 操作，以及原始／公開檔案各自的雜湊與不可覆寫路徑。簽名失敗、Storage 已成功但資料庫更新中斷等情況，會保留紀錄供重試。沒有宣稱整條網路流程具備 exactly-once 保證。

## 驗證

```powershell
npm run typecheck
npm run lint
npm test
npx vitest run tests/components/asset-http.test.tsx tests/components/asset-server.test.tsx
node tests/assets-browser.mjs
```

`tests/assets-browser.mjs` 使用真實 React 元件、既有 CSS、Playwright 與本機 API / TUS mock，涵蓋 320–1920px、axe、預覽載入、分頁、回收還原、發布重試、使用位置顯示，以及 7 MiB 分段直傳。不會登入或寫入正式 Supabase。

資料庫測試需要**獨立的本機 PostgreSQL**，資料庫名稱固定 `asset_library_test`，只連 `127.0.0.1:55432`：

```powershell
# 先用本機 PostgreSQL 的 createdb 建立 asset_library_test。
# Windows 預設使用 C:\Program Files\PostgreSQL\18\bin\psql.exe。
# 其他安裝位置可設定 PSQL_BINARY；不同測試埠可設定 ASSET_TEST_PG_PORT。
node scripts/test-assets-sql.mjs
```

每次執行會先清空這個測試資料庫再重建。fixture 模擬 Supabase 管理的 `auth` / `storage` schemas 與最小的 `posts` / `projects` / `project_media`，測試三個 asset migration 重複執行、權限、容量與預留失效、版本、還原、引用規則、衝突與兩條真實連線的並行請求。**不是完整的 Supabase Storage / Auth 整合測試**。正式啟用後，還需用你的管理員帳號做小檔端到端驗收。

## 回復與後續

- 修改前的本機快照：`artifacts/version-backups/2026-09-20-before-asset-library/`，未包含環境金鑰。這是當時的素材相關程式快照，不含後續其他工作，不能直接覆蓋整個專案。
- migration 為增量變更。若回退程式，保留新資料表與 buckets，不要用 DROP 或刪 Storage 來回退；否則會失去版本與紀錄。
- 原先會直接刪除照片／履歷的流程已停用。回退到舊程式也會回復這些舊行為，需先檢查。
- 尚未實作：全文／語意搜尋、durable worker queue、去重、撤銷公開副本、私人分享連結、全站 release snapshot、一鍵異地備份及災難復原。細節保留在 `file-management-extension-research.md`，本階段沒有把研究提案當成已交付功能。
