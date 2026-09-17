# 個人網站規格書 v1.0

> 用途：面試呈現 × 作品集深度 × 內容經營
> 交付對象：Codex（實作）／你（決策與內容）
> 建立日期：2026-09-13

---

## 0. 決策總表（42 題結論）

| # | 項目 | 決定 |
|---|---|---|
| 1 | 職務方向 | 軟體工程（全端）+ 資料／AI |
| 2 | 職涯階段 | 學生／新鮮人 |
| 3 | 核心目標 | 作品深度展示 + 內容流量經營 |
| 4 | 目標觀眾 | 台灣本地 + 海外／外商並重 |
| 5 | 語言 | 中英雙語，可切換（`/zh`、`/en`） |
| 6 | 首頁 | About 直接當首頁 |
| 7 | 第一版頁面 | About（首頁）、作品集列表、專案內頁 |
| 8 | Blog | 架構先建好，內容之後補 |
| 9 | 專案數量 | 4–6 個 |
| 10 | 專案內頁內容 | 案例研究 + 技術架構 + 截圖／Demo + 個人貢獻 |
| 11 | 履歷 | PDF 直接下載（中英各一份） |
| 12 | 聯絡方式 | Email + 聯絡表單 + 社群連結 全開 |
| 13 | 視覺風格 | 極簡黑白、排版導向 |
| 14 | 主題模式 | 預設跟隨系統，可手動切換 |
| 15 | 字體 | 無襯線現代感（Inter + Noto Sans TC） |
| 16 | 強調色 | 單一低調靛藍 |
| 17 | 版面密度 | 中等平衡 |
| 18 | 動畫 | 文字進場動畫 + 頁面轉場 |
| 19 | 框架 | Next.js 15（App Router, TypeScript） |
| 20 | 你的熟悉度 | 熟 React／Next（可自行維護） |
| 21 | 部署 | Vercel |
| 22 | 內容更新 | 自建後台 + 資料庫 |
| 23 | 樣式 | Tailwind CSS v4 |
| 24 | UI 元件 | shadcn/ui |
| 25 | 後端服務 | Supabase（Postgres + Auth + Storage） |
| 26 | 後台登入 | 單一管理員帳號 + 密碼（Supabase Auth） |
| 27 | 編輯器 | 精簡版 Markdown 編輯器 + 即時預覽 |
| 28 | 後台管理範圍 | 專案、文章、About／技能／經歷、履歷 PDF |
| 29 | 圖片 | Supabase Storage |
| 30 | 發布流程 | 草稿 → 排程 → 發布 |
| 31 | 雙語填寫 | 後台一鍵產生 AI 翻譯草稿，人工修正 |
| 32 | 分析 | Google Analytics 4 |
| 33 | SEO | sitemap + 結構化資料 + 自動 OG 圖 |
| 34 | 翻譯 API | Google Cloud Translation API v2 |
| 35 | 網域 | 尚未購買（見 §9 建議） |
| 36 | 表單寄信 | Resend |
| 37 | 網域後綴 | `.com` |
| 38 | RWD／無障礙 | 手機體驗必須完美 |
| 39 | 開發順序 | 先出 MVP 上線，再迭代 |
| 40 | 命名偏好 | 以 `Hsien` 為核心 |
| 41 | 內容狀態 | 專案已有，文字尚未整理（見 §10 範本） |
| 42 | 交付物 | 規格書 + 線框圖 + schema/API + Codex prompt |

---

## 1. 設計方向：Dossier Index（檔案索引）

### 1.1 概念
你不是要做一個「很潮的個人網站」，是要做一份**可被快速檢索的專業檔案**。面試官在手機上滑三十秒，必須看懂：你是誰、你做過什麼、深度在哪。

因此整站的結構隱喻是**索引與檔案夾**，不是行銷官網：

- 列表用**分隔線列（rule-separated rows）**呈現，不是卡片網格。資訊密度高、掃描快、行動裝置上不會變成一長串圓角方塊。
- 每個專案內頁左側有一條**固定的 meta 欄**（角色／期間／技術／連結），像檔案封面的欄位；右側是敘事主體。
- 全站只有一個「大膽時刻」：首頁進場時姓名與定位句的揭幕動畫。其餘一律安靜。

### 1.2 刻意避開的做法
這些是個人網站的預設值，會讓網站看起來像模板，一律不用：

- ❌ 卡片網格作品集（每張都是同樣圓角 + 同樣淺灰陰影）
- ❌ 每個標題上方的全大寫小標籤（`EXPERIENCE`、`SELECTED WORK`）
- ❌ 每個區塊滾動時都 fade-up
- ❌ 按鈕文字後面加 `→`
- ❌ 中間點串接的 meta 字串（`React · TypeScript · 2025`）→ 改用欄位式 meta
- ❌ 漸層裝飾、玻璃擬態、游標跟隨光暈

### 1.3 色彩（4 個命名值 × 雙模式）

極簡黑白基底，靛藍只用在**互動與狀態**（連結、focus、目前位置），不用在裝飾。

**Light（`:root`）**
| Token | Hex | 用途 |
|---|---|---|
| `--paper` | `#FFFFFF` | 頁面底色 |
| `--ink` | `#121316` | 主要文字 |
| `--graphite` | `#5C5F66` | 次要文字、meta |
| `--rule` | `#E2E3E7` | 分隔線、邊框 |
| `--ash` | `#F5F5F6` | 區塊底色、程式碼底 |
| `--indigo` | `#2B3FA8` | 連結、focus、強調 |

**Dark（`.dark`）**
| Token | Hex | 用途 |
|---|---|---|
| `--paper` | `#0C0D10` | 頁面底色（帶極微冷調，與靛藍同調） |
| `--ink` | `#F1F2F4` | 主要文字 |
| `--graphite` | `#9A9DA5` | 次要文字、meta |
| `--rule` | `#25272C` | 分隔線、邊框 |
| `--ash` | `#15171B` | 區塊底色 |
| `--indigo` | `#95A4FF` | 連結、focus、強調 |

規則：
- 主要文字對比至少 **7:1**，次要文字至少 **4.5:1**。
- 靛藍在深色模式必須調亮，禁止兩模式共用同一個 hex。
- 不使用陰影做層次，層次一律靠**分隔線與留白**。唯一例外：後台的 dropdown／dialog。

### 1.4 字體與排版

| 角色 | 字體 | 說明 |
|---|---|---|
| 拉丁文字 | **Inter**（`next/font/google`, variable） | 全站主體 |
| 中文 | **Noto Sans TC**（400／500／700） | 與 Inter 搭配，字面大小接近 |
| 程式碼／數據 | **JetBrains Mono** | 僅用於程式碼區塊與量化指標數字 |

**類型尺度**（1.26 比例，rem）
| 名稱 | 桌機 | 手機 | 字重 | 行高 | 字距 |
|---|---|---|---|---|---|
| display | 4.0rem | 2.4rem | 600 | 1.05 | -0.03em |
| h1 | 2.6rem | 1.9rem | 600 | 1.15 | -0.02em |
| h2 | 1.7rem | 1.45rem | 600 | 1.25 | -0.01em |
| h3 | 1.3rem | 1.2rem | 600 | 1.35 | 0 |
| body-lg | 1.15rem | 1.05rem | 400 | 1.7 | 0 |
| body | 1.0625rem | 1rem | 400 | 1.7 | 0 |
| meta | 0.875rem | 0.875rem | 400 | 1.5 | 0.01em |
| mono | 0.9rem | 0.85rem | 400 | 1.6 | 0 |

中文排版補強：
- 中文段落 `line-height: 1.85`、`letter-spacing: 0.015em`（英文保持 0）。
- 使用 `text-wrap: pretty` 避免孤字；標題用 `text-wrap: balance`。
- 正文最大寬度 **68ch**（中文約 36 字）。

**對齊**：全站左對齊（`text-align: left`），不用置中大標。理由是索引感與可掃描性；置中排版在雙語切換時中英長度差異會造成視覺跳動。

### 1.5 佈局

- 容器最大寬 **1080px**，左右 padding：手機 20px／平板 32px／桌機 48px。
- 間距基準 4px；區塊垂直節奏 `64 / 96 / 128`（手機 `48 / 64 / 80`）。
- 圓角僅兩級：`4px`（輸入框、標籤）與 `8px`（圖片、對話框）。分隔線列不加圓角。
- 邊框一律 1px；hairline 在 retina 用 `0.5px` 不做特殊處理（避免跨裝置不一致）。

### 1.6 動畫規範

| 場景 | 效果 | 參數 |
|---|---|---|
| 首頁進場（唯一大膽時刻） | 姓名與定位句以 `clip-path` 由下往上揭幕，逐行 stagger | 0.7s, `cubic-bezier(0.16,1,0.3,1)`, stagger 0.08s，**每個 session 只播一次**（sessionStorage） |
| 頁面轉場 | 內容淡入 + 位移 6px | 0.28s, ease-out |
| 列表 hover | 左側靛藍 2px 指示線由上展開，文字位移 2px | 0.18s |
| 主題切換 | 無過渡（避免整頁閃爍） | — |
| 其他區塊 | **不做**滾動進場動畫 | — |

`prefers-reduced-motion: reduce` 時：全部動畫關閉，只保留 opacity 瞬切。

---

## 2. 資訊架構

```
/                        → 依 Accept-Language 重導向至 /zh 或 /en
/[locale]                → About（首頁）
/[locale]/projects       → 作品集列表
/[locale]/projects/[slug]→ 專案內頁
/[locale]/blog           → 文章列表（無文章時導覽列隱藏）
/[locale]/blog/[slug]    → 文章內頁
/[locale]/contact        → 聯絡
/resume/[locale].pdf     → 履歷（重導向到 Storage 公開網址）

/admin/login             → 登入
/admin                   → 儀表板
/admin/projects          → 專案列表（可拖曳排序）
/admin/projects/new      → 新增
/admin/projects/[id]     → 編輯（雙語分頁 + AI 翻譯）
/admin/posts             → 文章管理
/admin/posts/[id]
/admin/profile           → 個人資料、社群連結、履歷 PDF
/admin/experience        → 經歷／學歷／獲獎
/admin/skills            → 技能
/admin/media             → 圖片管理
/admin/messages          → 聯絡表單訊息
```

導覽列：`About / Projects / Blog(條件顯示) / Contact` + 語言切換 + 主題切換。
`/admin` 全部 `noindex, nofollow`，且不出現在 sitemap。

---

## 3. 頁面線框圖

### 3.1 首頁（About）— 桌機

```
┌──────────────────────────────────────────────────────────────┐
│  Hsien              About  Projects  Blog  Contact   中/EN ☾ │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   全端與資料工程                          ← display，揭幕動畫  │
│   我做能被量測的系統。                     ← 定位句一行        │
│                                                              │
│   目前 ── 政治大學資訊科學系  |  找 2027 新鮮人職缺           │
│   ────────────────────────────────────────────────────────   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  精選專案                                      看全部作品(4)  │
│  ──────────────────────────────────────────────────────────  │
│  │ 專案名稱                     解決的問題一句話        2025 │
│  │ Next.js  Postgres  LLM                                    │
│  ──────────────────────────────────────────────────────────  │
│  │ 專案名稱                     解決的問題一句話        2025 │
│  │ Python  PyTorch  AWS                                      │
│  ──────────────────────────────────────────────────────────  │
├──────────────────────────────────────────────────────────────┤
│  經歷                                                        │
│  2025.07–2025.09  ○ 公司名稱 ── 後端實習                      │
│                     一句話說明做了什麼、影響是什麼             │
│  2023.09–迄今     ○ 學校 ── 科系                              │
├──────────────────────────────────────────────────────────────┤
│  技能                                                        │
│  語言      TypeScript   Python   SQL   Go                    │
│  前端      React   Next.js   Tailwind                        │
│  資料／AI  PyTorch   pandas   dbt                            │
│  基礎設施  Docker   AWS   Supabase                           │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐  │
│  │  在找新鮮人職缺，也歡迎聊聊專案。                       │  │
│  │  [ 寄信給我 ]   [ 下載履歷 PDF ]                        │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  GitHub   LinkedIn   Email            © 2026 Hsien           │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 首頁 — 手機（優先設計）

```
┌──────────────────────┐
│ Hsien          ☰  ☾  │  ← 漢堡選單展開為全螢幕，語言切換在內
├──────────────────────┤
│                      │
│ 全端與               │
│ 資料工程             │  ← display 2.4rem
│                      │
│ 我做能被量測的系統。 │
│                      │
│ 目前                 │
│ 政大資科 · 找 2027   │
│ 新鮮人職缺           │
│ ──────────────────── │
│ [ 下載履歷 ]         │  ← 手機把 CTA 提前，面試官常用手機
├──────────────────────┤
│ 精選專案             │
│ ──────────────────── │
│ 專案名稱        2025 │
│ 一句話問題敘述        │
│ Next.js Postgres LLM │
│ ──────────────────── │
│ ...                  │
```

### 3.3 作品集列表

```
┌──────────────────────────────────────────────────────────────┐
│  作品集                                                      │
│  四個從想法做到上線的專案。                                   │
│                                                              │
│  全部(4)   網頁(3)   資料／AI(2)        ← 標籤篩選，非下拉選單 │
│  ──────────────────────────────────────────────────────────  │
│  │ ▌專案名稱                                           2025 │
│  │  用一句話說清楚解決什麼問題。                             │
│  │  角色 全端 · 3 人團隊      TypeScript Next.js Postgres   │
│  ──────────────────────────────────────────────────────────  │
│  │ ▌專案名稱                                           2025 │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```
（`▌` = hover／focus 時出現的靛藍指示線）

### 3.4 專案內頁（案例研究結構）

```
┌──────────────────────────────────────────────────────────────┐
│  ← 作品集                                                    │
│                                                              │
│  專案名稱                                                    │
│  一句話說清楚這個專案解決什麼問題。                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              封面圖 / Demo 影片 (16:9)                  │  │
│  └────────────────────────────────────────────────────────┘  │
├───────────────┬──────────────────────────────────────────────┤
│ [sticky meta] │  問題                                        │
│               │  為什麼這件事值得做，原本的痛點是什麼。       │
│ 期間          │                                              │
│ 2025.03–06    │  解法                                        │
│               │  你怎麼設計的，做了哪些取捨。                 │
│ 角色          │                                              │
│ 全端 / 3 人   │  ┌──────────────────────────────────────┐    │
│               │  │         架構圖（可點擊放大）          │    │
│ 技術          │  └──────────────────────────────────────┘    │
│ Next.js       │  架構說明兩三句。                            │
│ Postgres      │                                              │
│ Redis         │  實作細節                                    │
│ Docker        │  Markdown 內文，含程式碼區塊。                │
│               │                                              │
│ 連結          │  ┌──────┬──────┬──────┐                      │
│ Live Demo     │  │ 截圖 │ 截圖 │ 截圖 │  ← 點擊開 lightbox  │
│ GitHub        │  └──────┴──────┴──────┘                      │
│               │                                              │
│               │  成果                                        │
│               │   120ms      3,000+      40%                 │
│               │   P95 延遲    月活用戶    人工工時減少        │
│               │                          ← mono 數字         │
│               │                                              │
│               │  我的貢獻                                    │
│               │  明確寫出哪幾塊是你做的、學到什麼。           │
├───────────────┴──────────────────────────────────────────────┤
│  上一個專案  ←                            →  下一個專案       │
└──────────────────────────────────────────────────────────────┘
```

手機版：meta 欄摺疊到標題下方，變成兩欄的欄位表。

### 3.5 聯絡頁

```
┌──────────────────────────────────────────────────────────────┐
│  聯絡                                                        │
│  找我聊職缺、專案合作，或任何技術問題。                       │
│                                                              │
│  Email      hi@example.com          [複製]                   │
│  GitHub     github.com/…                                     │
│  LinkedIn   linkedin.com/in/…                                │
│  ──────────────────────────────────────────────────────────  │
│  姓名   [                    ]                               │
│  Email  [                    ]                               │
│  主旨   [                    ]                               │
│  訊息   [                    ]                               │
│         [                    ]                               │
│         [ 送出訊息 ]                                          │
│         送出後我會在兩個工作天內回覆。                        │
└──────────────────────────────────────────────────────────────┘
```

### 3.6 後台專案編輯

```
┌──────────────────────────────────────────────────────────────┐
│ 後台   專案  文章  個人資料  經歷  技能  圖片  訊息      登出 │
├──────────────────────────────────────────────────────────────┤
│ ← 專案      編輯專案                  [儲存草稿] [發布設定 ▾] │
│                                                              │
│ ┌─ 中文 ─┬─ English ─┐        [ 用 AI 從中文產生英文草稿 ]   │
│ │                                                            │
│ │ 標題      [                                      ]         │
│ │ 網址代稱  [ my-project ]  → /zh/projects/my-project        │
│ │ 一句話摘要[                                      ]         │
│ │ 問題      [ Markdown ▏預覽 ]                                │
│ │ 解法      [ Markdown ▏預覽 ]                                │
│ │ 成果      [ Markdown ▏預覽 ]                                │
│ │ 我的貢獻  [ Markdown ▏預覽 ]                                │
│ │ 實作細節  [ Markdown ▏預覽 ]                                │
│ └────────────────────────────────────────────────────────────┤
│ 共用欄位（不分語言）                                          │
│ 封面圖 [ 拖放上傳 ]   架構圖 [ 拖放上傳 ]                     │
│ 截圖   [+] [圖][圖][圖]  ← 可拖曳排序，每張可填雙語 alt      │
│ 技術標籤 [ Next.js ×] [ Postgres ×] [ + ]                    │
│ 期間 [2025-03] – [2025-06]   角色 [全端]  團隊 [3]           │
│ Demo [https://]  GitHub [https://]  影片 [https://]          │
│ 量化成果 [標籤][數值] [+ 新增]                                │
│                                                              │
│ 發布設定：( ) 草稿  ( ) 排程 [2026-09-20 09:00]  (•) 發布     │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. 技術規格

### 4.1 技術棧

| 層 | 選型 | 備註 |
|---|---|---|
| 框架 | Next.js 15（App Router、RSC、TypeScript strict） | |
| 樣式 | Tailwind CSS v4 + CSS 變數 token | token 定義在 `@theme` |
| 元件 | shadcn/ui（只裝用得到的） | button, input, textarea, tabs, dialog, dropdown-menu, toast, badge, switch |
| 動畫 | `motion`（Framer Motion 12） | 僅用於首頁揭幕與頁面轉場 |
| i18n | `next-intl` | `/[locale]` 路由，locale = `zh` \| `en` |
| 主題 | `next-themes` | class 策略，含防閃爍 script |
| 資料庫 | Supabase Postgres | |
| 驗證 | Supabase Auth（Email + 密碼） | 單一管理員 |
| 儲存 | Supabase Storage | bucket: `media`, `resume` |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-shiki` | 後台預覽與前台渲染共用元件 |
| 表單 | `react-hook-form` + `zod` | |
| 寄信 | Resend | |
| 翻譯 | Google Cloud Translation API v2 | |
| 分析 | GA4 via `@next/third-parties` | |
| OG 圖 | `next/og`（`ImageResponse`） | |
| 部署 | Vercel（含 Cron） | |

### 4.2 資料抓取與快取

- 所有前台頁面用 **Server Component + `unstable_cache`／`revalidateTag`**，靜態為主。
- Tag 命名：`projects`、`project:{slug}`、`posts`、`post:{slug}`、`profile`、`experience`、`skills`。
- 後台任何寫入成功後，呼叫對應 `revalidateTag()`。
- `generateStaticParams` 產生所有已發布 slug × 兩種語言。

### 4.3 排程發布

1. 內容 `status` 有四種：`draft` / `scheduled` / `published` / `archived`。
2. 公開查詢條件固定為 `status = 'published' AND published_at <= now()`。
3. Vercel Cron 每 10 分鐘打 `POST /api/cron/publish`（帶 `CRON_SECRET`）：
   - 把 `status='scheduled' AND published_at <= now()` 的列改成 `published`
   - 針對每筆呼叫 `revalidateTag`
4. `vercel.json`：
```json
{ "crons": [{ "path": "/api/cron/publish", "schedule": "*/10 * * * *" }] }
```

### 4.4 AI 翻譯流程

- 後台編輯頁的按鈕「用 AI 從中文產生英文草稿」→ `POST /api/admin/translate`
- 輸入：`{ fields: { title: "...", summary: "...", ... }, from: "zh-TW", to: "en" }`
- 後端用 Google Translation API v2 批次翻譯（`format: "text"`，Markdown 逐欄送出、保留段落）
- **絕不自動存檔**：結果填入英文分頁的表單欄位，由你確認後才儲存
- 欄位旁顯示「AI 草稿，尚未校閱」標記，儲存時清除

### 4.5 安全性

- `SUPABASE_SERVICE_ROLE_KEY` 只在 Server Actions／Route Handler 使用，禁止進 client bundle。
- RLS 全表開啟；anon 只能讀已發布內容。
- `middleware.ts` 保護 `/admin/*`：無 session 導向 `/admin/login`；session email ≠ `ADMIN_EMAIL` 一律 403。
- 聯絡表單：zod 驗證 + honeypot 欄位 + 同 IP 每小時 5 次上限（存於 `contact_rate_limit` 或 Upstash）。
- 上傳檔案白名單：`image/png, image/jpeg, image/webp, image/svg+xml, application/pdf`，單檔 ≤ 8MB。
- 所有 `/admin` 回應帶 `X-Robots-Tag: noindex`。

### 4.6 SEO

- 每頁 `generateMetadata`：title、description、canonical、`alternates.languages`（zh/en 互指 + `x-default`）。
- 結構化資料（JSON-LD）：
  - 首頁：`Person` + `ProfilePage`（含 `sameAs` 社群連結、`knowsAbout` 技能）
  - 專案頁：`CreativeWork`
  - 文章頁：`BlogPosting`
  - 全站：`BreadcrumbList`
- `app/sitemap.ts` 動態產生（兩語言全頁面）、`app/robots.ts`。
- `app/rss.xml/route.ts` 提供文章 RSS。
- OG 圖：`/api/og?title=&subtitle=&kind=` 以 `ImageResponse` 產生 1200×630，黑底白字 + 靛藍細線，不做花俏效果。

### 4.7 效能與無障礙（手機優先）

- 目標：Lighthouse 行動版 Performance ≥ 95、Accessibility 100，LCP < 2.0s，CLS < 0.05。
- 圖片一律 `next/image`，`sizes` 正確設定，封面圖 `priority`。
- 字體 `display: swap` + `preload`，中文字體用 subset。
- 標準：**WCAG 2.1 AA**。焦點可見（2px 靛藍外框 + 2px offset）、鍵盤可完整操作、skip-to-content 連結、圖片必填 alt、表單 label 綁定、`lang` 屬性隨 locale 切換。
- 觸控目標最小 44×44px。

---

## 5. 資料模型

完整 SQL 見 `supabase-schema.sql`。摘要：

| 資料表 | 用途 | 雙語欄位 |
|---|---|---|
| `profile` | 單列，姓名／定位句／簡介／頭像／履歷 PDF | `*_zh`, `*_en` |
| `social_links` | 社群連結（可排序、可隱藏） | — |
| `skills` | 技能，含分類與排序 | 分類雙語 |
| `experiences` | 工作／學歷／獲獎／活動 | 機構、職稱、說明 |
| `projects` | 專案主表（案例研究五段） | 全部內容欄位 |
| `project_media` | 專案截圖／影片，可排序 | caption、alt |
| `project_metrics` | 量化成果（標籤 + 數值） | 標籤 |
| `posts` | 文章 | 全部內容欄位 |
| `messages` | 聯絡表單訊息 | — |
| `media_assets` | 圖片庫 | alt |
| `site_settings` | 鍵值設定（導覽列開關等） | — |

命名規則：雙語欄位一律 `欄位名_zh` / `欄位名_en`；讀取時由 `pickLocale(row, locale)` 統一處理，英文空白時 fallback 中文。

---

## 6. API 與 Server Actions

### 6.1 公開讀取（Server Component 直接查詢，不開 REST）
```ts
getProfile()                       // 含 social_links
listProjects({ tag?, limit? })     // 已發布，依 sort_order
getProjectBySlug(slug)             // 含 media、metrics、前後筆
listPosts({ tag?, page? })
getPostBySlug(slug)
listExperiences()
listSkills()
```

### 6.2 Route Handlers
| 方法 | 路徑 | 用途 | 保護 |
|---|---|---|---|
| POST | `/api/contact` | 聯絡表單 → 存 DB + Resend 寄信 | rate limit + honeypot |
| GET | `/api/og` | 動態 OG 圖 | 公開 |
| POST | `/api/cron/publish` | 排程發布 | `CRON_SECRET` |
| POST | `/api/admin/translate` | AI 翻譯草稿 | admin session |
| POST | `/api/admin/upload` | 圖片／PDF 上傳 | admin session |
| GET | `/api/preview/[type]/[slug]` | 草稿預覽 | admin session |

### 6.3 Server Actions（`app/admin/_actions/`）
```
projects:   create / update / remove / reorder / setStatus
posts:      create / update / remove / setStatus
profile:    update / updateResume
social:     upsert / remove / reorder
skills:     upsert / remove / reorder
experience: upsert / remove / reorder
media:      upload / updateAlt / remove
messages:   markRead / remove
```
每個 action 一律：`zod 驗證 → 檢查 session → 寫入 → revalidateTag → 回傳 { ok, error? }`。

---

## 7. 環境變數

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 僅伺服器端
ADMIN_EMAIL=                      # 唯一允許登入後台的帳號
RESEND_API_KEY=
CONTACT_TO_EMAIL=                 # 收信信箱
CONTACT_FROM_EMAIL=               # 需通過網域驗證，例如 noreply@your-domain.com
GOOGLE_TRANSLATE_API_KEY=
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
CRON_SECRET=
```

---

## 8. 開發階段（MVP 優先）

### Phase 1 — MVP 上線（目標：可以放進履歷的網址）
1. Next.js + TypeScript + Tailwind v4 + shadcn/ui 初始化
2. 設計 token、字體、主題切換、版面容器
3. `next-intl` 雙語路由與翻譯檔
4. Supabase 建專案、跑 schema、建管理員帳號、seed 假資料
5. About 首頁（含揭幕動畫）、作品集列表、專案內頁
6. 履歷下載按鈕、頁尾社群連結
7. 部署到 Vercel + 綁網域

**驗收**：手機 Lighthouse Performance ≥ 95、Accessibility 100；兩種語言皆可瀏覽；深淺色正常。

### Phase 2 — 後台
8. Supabase Auth 登入 + middleware 保護
9. 專案 CRUD、拖曳排序、Markdown 編輯器 + 預覽
10. 圖片上傳到 Storage、圖片庫、alt 編輯
11. 個人資料 / 經歷 / 技能 / 社群連結管理、履歷 PDF 更換
12. 把 seed 假資料換成真實內容

**驗收**：不碰程式碼即可完成一個專案的新增與發布。

### Phase 3 — 內容與自動化
13. Blog 列表與內頁、標籤
14. 草稿／排程／發布狀態機 + Vercel Cron
15. AI 翻譯草稿按鈕
16. 聯絡表單 + Resend + 後台訊息匣

### Phase 4 — 成長與打磨
17. sitemap / robots / RSS / JSON-LD / 動態 OG 圖
18. GA4 + Vercel Speed Insights
19. 404、載入骨架、空狀態文案
20. 效能與無障礙最終稽核

---

## 9. 網域建議

你偏好以 `Hsien` 為核心、`.com` 後綴。先講一個誠實的建議：**`0826` 看起來像生日，在履歷上會偏個人化而非專業化**。如果 `hsien.com` 這類短網域買不到（幾乎確定買不到），以下是比數字後綴更好的方向。

**優先順序**
1. `姓氏+名字.com` — 最專業，面試官一看就知道是誰（例：`hsienchang.com`）
2. `名字+領域.com` — 例：`hsienbuilds.com`、`hsienlabs.com`
3. `made/by + 名字` — 例：`byhsien.com`、`madebyhsien.com`
4. `hsien0826.com` — 可用但最後考慮

**注意事項**
- 中文姓名的羅馬拼音要與你履歷、LinkedIn、GitHub **完全一致**，否則面試官搜尋不到你。
- 避免連字號（`hsien-chang.com` 口頭講很難念）。
- 註冊商建議 **Cloudflare Registrar**（成本價、無首年誘餌價、免費 WHOIS 隱私）；備選 Porkbun、Namecheap。
- 預算抓 NT$400–600／年。

**Vercel 綁定步驟**：Vercel 專案 → Settings → Domains → 加入網域 → 到註冊商設定 `A` 記錄指向 `76.76.21.21`，`CNAME www` 指向 `cname.vercel-dns.com` → 等待驗證 → 設定 `www` 轉址到主網域。

---

## 10. 專案內容整理範本

你說專案還沒整理。每個專案先用這份範本寫一份中文，再丟給後台的 AI 翻譯產英文草稿。**先寫兩個最強的就能上線**。

```markdown
### 專案名稱
[產品化的名字，不要用 repo 名稱]

### 一句話摘要（40 字內）
[給誰、解決什麼問題、用什麼方法]
範例：讓助教在 5 分鐘內批改 200 份程式作業的自動評分系統。

### 期間 / 角色 / 團隊
2025.03 – 2025.06 / 全端 / 3 人

### 問題（120–200 字）
- 原本的做法是什麼？
- 誰在痛？痛在哪？有多痛（數字）？
- 為什麼現成方案不夠用？

### 解法（200–300 字）
- 整體設計是什麼？
- 關鍵的兩個技術決策，以及你放棄了哪些選項、為什麼？
- 遇到最難的問題是什麼，怎麼解的？

### 架構圖
[用 Excalidraw 或 Mermaid 畫一張，匯出 PNG。圖裡要有資料流方向。]

### 成果（務必量化，3 個數字）
- 指標名稱：數值（例：批改時間 4 小時 → 5 分鐘）
- 指標名稱：數值
- 指標名稱：數值
- 若沒有正式數字：用測試數據、benchmark、使用者回饋數量替代

### 我的貢獻
- 我負責：[明確列出你寫的模組]
- 我不負責：[誠實標註，面試官會追問]
- 我學到：[一個具體的技術或協作啟發]

### 技術標籤（5–8 個）
TypeScript, Next.js, PostgreSQL, Redis, Docker, AWS

### 連結
Live Demo: / GitHub: / Demo 影片:

### 截圖（3–5 張）
1. [畫面說明]
2. [畫面說明]
```

**寫作提醒**
- 每段第一句就講結論，不要鋪陳。
- 用「我」而不是「我們」描述你做的部分。
- 沒有數字的成果約等於沒有成果，盡量找到可以量測的東西。
- 英文版不要直譯中文長句，拆成短句，用主動語態。
