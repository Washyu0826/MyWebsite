# 實作進度

目前實作範圍為 `codex-prompt.md` 的 Phase 1。原始三份文件已完整閱讀並保留於根目錄與 `docs/`。

## 已完成

- Next.js 15.5.25、React 19、TypeScript strict、Tailwind v4、next-intl、next-themes、Motion、Supabase client 初始化。
- 雙語 About／作品列表／案例頁／聯絡資訊與 404。
- 分隔線作品列表、固定 meta 欄、URL 標籤篩選、手機選單、圖片 lightbox、Email 複製、履歷語言路由。
- Inter、Noto Sans TC、JetBrains Mono，雙主題色彩與排版 token。
- 公開內容查詢與快取，管理員 client 的伺服器端隔離。
- 明確的示範模式、四個示範案例、可選 SQL seed、環境變數與部署文件。

## 驗證紀錄

- TypeScript：通過。
- ESLint：通過，0 errors / 0 warnings。
- 單元測試：4 項通過。
- npm audit：PostCSS override 修補後 0 vulnerabilities。
- Production build：通過，產生中英首頁／聯絡頁與 8 個案例頁；公開內容使用 5 分鐘 ISR 快取。
- 瀏覽器：20 項案例均已通過。Chrome 首輪 18 項通過，2 項修正後定向重測通過。
- axe：16 個「語言 × 主題 × 頁面」組合的 WCAG A／AA 掃描均無違規；375px 無橫向捲動。
- 互動：URL 篩選與語言切換、手機選單焦點循環／Escape／焦點還原、圖片 lightbox、Accept-Language、履歷缺檔導向與 HTTP 404 通過。
- Client bundle 搜尋未出現 `SUPABASE_SERVICE_ROLE_KEY`；目前尚未設定任何真實金鑰。
- Lighthouse 行動版：Performance **96**、Accessibility **100**、Best Practices **100**、SEO **63**。SEO 唯一扣分為示範模式刻意設定的 `noindex`。
- FCP 約 1.4 秒、LCP 約 2.5 秒、TBT 約 110ms。LCP 尚未達規格的 2 秒進階目標，正式部署後仍需驗證。
- 報告：`artifacts/lighthouse-mobile.html`、`artifacts/lighthouse-mobile.json`。
- 截圖：`artifacts/home-desktop.png`、`artifacts/home-mobile.png`、`artifacts/project-mobile-dark.png`，已檢視桌機／手機與深色案例的版面。
- 效能調整：Noto Sans TC 使用單一可變字體，減少重複的 unicode-range CSS；動畫採 Motion 的 `react-mini` 原生動畫介面，首頁首次載入 JavaScript 從約 160 kB 降為 123 kB。
- 最後的字體／動畫回歸測試：7 項全部通過，涵蓋首頁四種語言／主題、URL 語言切換、選單與 lightbox。

測試過程修正了標題層級、聯絡資訊／量化成果的定義列表語意，並移除會令不存在頁面提早串流 HTTP 200 的全站 loading 邊界。後續骨架載入需限縮到已確認存在的內容，保留正確的 404 回應。axe 掃描會等待設計樣式與字體載入，避免把未套用 CSS 的中間狀態當成完成畫面。

## 需要外部設定才能驗證

- Supabase 專案與 schema 實際執行、RLS 與 Storage 實測。
- 真實資料庫的 `supabase gen types`；目前型別明確標記為暫用且禁止寫入。
- 個人姓名、經歷、案例敘事、績效證據、社群網址與中英履歷 PDF。
- Vercel 帳號、部署及正式網域。

## 後續階段

- Phase 2：Supabase Auth、管理員權限、專案 CRUD、排序、Markdown 編輯與媒體管理。
- Phase 3：Blog、發布狀態、排程、Resend 聯絡表單、翻譯草稿。
- Phase 4：完整 sitemap／robots／RSS／JSON-LD／OG、GA4 與正式站效能驗收。

## 文件中留待後續處理的差異

- 原始 schema 並非完整冪等 migration：多次執行 trigger／policy 建立會出錯；部署說明已標示僅初始化使用。
- 排程規格將 Vercel Cron 寫成 POST；實作 Phase 3 時應依當時官方介面確認 HTTP 方法及方案排程限制。
- 公開 Storage bucket 不會隨草稿 RLS 隱藏已知 URL；若需要保密草稿媒體，Phase 2 應區分私有草稿與公開資產。
- 首頁版型為左對齊索引，不使用卡片網格、漸層與捲動進場動畫。
