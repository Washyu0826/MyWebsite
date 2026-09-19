# 無障礙（WCAG 2.2 AA）

本站以 **WCAG 2.2 AA** 為驗收標準。自動掃描（axe-core，含 `wcag22a` / `wcag22aa` 標籤）只是最低門檻，
本文記錄的是人工驗證與實測數據：完整鍵盤路徑、焦點順序與可見性、動態內容的朗讀、實際算繪像素的對比度、
目標尺寸，以及 2.2 新增的四條準則。

逐項稽核紀錄（含尚待其他工作階段處理的項目）在 [`tests/a11y-audit.md`](../tests/a11y-audit.md)。

---

## 1. 驗收方式

| 面向 | 做法 |
|------|------|
| 自動掃描 | `@axe-core/playwright`，tags：`wcag2a` `wcag2aa` `wcag21a` `wcag21aa` `wcag22a` `wcag22aa` `best-practice` |
| 鍵盤 | 用 `Tab` 走完每一頁，記錄每一站的元素、可見焦點樣式、尺寸，以及是否被 sticky 標頭遮住 |
| 對比度 | 不信任 CSS 宣告：對每個文字區塊截圖兩次（一次把文字設成 `transparent`），從**實際像素**取最差的背景色，再和 computed `color` 算比值。立體派背景是 `<canvas>`，只有這個方法能量到真正疊合後的顏色 |
| 朗讀 | 檢查 `role="status"` / `aria-live` 區域的文字內容與更新時機 |
| 觸控 | Chrome 觸控模擬（iPhone 13, 390×844, `hasTouch`），用 CDP `Input.dispatchTouchEvent` 送真正的多點觸控事件 |

重跑方式：`npx next dev -p 3222`，再用 Playwright（`chromium.launch({ channel: 'chrome' })`）驅動。

### axe 掃描結果（2026-09-20）

| 路徑 | violations | incomplete |
|------|-----------:|-----------:|
| `/zh` | **0** | 2（`color-contrast` ×36：立體派背景，見下節；`aria-prohibited-attr` ×1） |
| `/en` | **0** | 2（同上） |
| `/zh/projects` | **0** | 1（`color-contrast` ×42） |
| `/zh/articles` | **0** | 0 |
| `/admin/login` | **0** | 0 |
| Lightbox 開啟（iPhone 13） | **0** | — |

`incomplete` 不是違規，是 axe 無法判定（背景是 `<canvas>` 或半透明疊層）。那些案例改用下面的像素量測。

> `/zh/contact` 在驗證當下正被另一個工作階段改寫（`Cannot find module for page: /[locale]/contact/page`），
> 這次沒有掃到，需要補掃。

---

## 2. 感知（Perceivable）

### 1.4.3 對比（最低）— 立體派背景

首頁的 `.cubist-backdrop` 是一張逐格繪製的 `<canvas>`，`opacity: 0.62`，上面再壓三層 `--paper` 漸層。
文字疊在它上面，是全站唯一「背景色不是常數」的地方，也是自動掃描唯一無法判定的地方
（axe 在 `/zh` 回報 38 筆 `color-contrast` **incomplete**，不是違規，是「我算不出來」）。

量測結果（深色主題，`--paper #0D0E10`）：

| 元素 | 字級 / 字重 | 類別 | 最差比值 | AA 門檻 | 結果 |
|------|------------|------|---------|---------|------|
| `.hero h1` | 64px / 600 | 大字 | **5.03:1**（最差背景 `rgb(124,100,89)`） | 3:1 | 通過 |
| `.hero .positioning p` | 18.4px / 400 | 一般 | **4.69:1**（`rgb(113,110,95)`） | 4.5:1 | 通過（**餘裕最小**） |
| `.signature-principle p` | 13px / 400 | 一般 | 5.04:1（`rgb(57,55,53)`） | 4.5:1 | 通過 |
| `.signature-principle strong` | 14px / 700 | 一般 | 8.03:1 | 4.5:1 | 通過 |
| `.signature-principle span` | 12px / 400 | 一般 | 6.77:1 | 4.5:1 | 通過 |
| `.brand`（標頭） | 16px / 650 | 一般 | 6.03:1 | 4.5:1 | 通過 |

`.status-line span` 與 `.hero-focus-list li` 的自動量測會回報失敗，但那是量法本身的假警報：
前者裡的 `<strong>` 自己宣告了 `color: var(--ink)`，不會被探針的 `color: transparent` 覆蓋；
後者的 `li::before` 是一顆 `background: var(--ink)` 的小圓點。兩者都不是背景，實際背景與同一區塊其他文字相同。

之所以還有餘裕，是因為 `.cubist-backdrop::after` 在文案欄方向疊了一層 `color-mix(in srgb, var(--paper) 74%, transparent)`
的漸層，等於先把畫面壓回接近底色再放文字。**`.hero .positioning p` 只剩 0.19 的餘裕**：
改動那層漸層、`opacity`，或把畫布的顏色調亮，都必須重跑這個量測。

### 1.4.4 文字縮放 / 1.4.10 重排

- `viewport` 只設 `width=device-width, initial-scale=1, viewport-fit=cover`，**沒有** `maximum-scale` 或 `user-scalable=no`，
  瀏覽器縮放完全可用。
- Lightbox 的雙指縮放只掛在對話框內的圖片舞台上（`touch-action: none` 僅限該元素），不會攔截頁面本身的縮放。
- 390px 寬時沒有水平溢出。

---

## 3. 可操作（Operable）

### 2.1.1 鍵盤

首頁 `Tab` 順序（實測，`/zh`）：

```
跳到主要內容 → 品牌 → 關於 → 作品集 → 文章 → 聯絡 → 語言切換 → 命令面板 → 主題 → 社群連結 ×3 → 內容 → 頁尾連結
```

DOM 順序等於視覺順序，沒有任何 `tabindex > 0`。

新增的互動元件都可以只用鍵盤完成：

| 元件 | 鍵盤操作 |
|------|---------|
| 排序清單 | `Tab` 到把手 → `空白鍵` 抓起 → `↑` `↓` 移動 → `空白鍵` 放下 → `Esc` 取消；或直接用「上移／下移」按鈕（實測：抓起／移動／放下／儲存全部成功，焦點留在把手上） |
| Lightbox | `←` `→` 換圖、`+` `-` 縮放、`0` 還原、`Esc` 關閉 |
| 手機選單 | `Esc` 或關閉按鈕（下滑手勢只是附加） |
| Markdown 預覽 | 一個 `aria-expanded` 的收合按鈕 |

### 2.4.7 可見的焦點

全站 `:focus-visible` 是 `2px solid var(--indigo)` + `2px` offset（後台加粗為 3px）。
18 個焦點站點全部量到可見輪廓，沒有任何 `outline: none`。

### 2.4.11 焦點不被遮蔽（2.2 新增）

`.site-header` 是 `position: sticky; z-index: 20`，約 76px 高。瀏覽器把焦點元素捲進視窗時不會把 sticky 標頭算進去，
所以往回 `Tab` 時焦點有機會被壓在標頭下。

- **後台已修**：`src/styles/admin.css` 的 `.admin-main :focus-visible { scroll-margin-top: 96px; scroll-margin-bottom: 24px; }`。
- **公開站台待修**：需要動 `src/styles/layout.css`（其他工作階段擁有），細節寫在 `tests/a11y-audit.md` B1-2。
- Skip link 取得焦點時位於 `z-index: 100`，蓋在標頭之上，不受影響。

### 2.5.7 拖曳動作（2.2 新增）

本次新增了三種手勢，每一種都有不需要拖曳的等價操作：

| 手勢 | 等價操作 |
|------|---------|
| 拖曳排序 | 永遠顯示的 44px「上移 ↑ / 下移 ↓」按鈕；以及空白鍵 + 方向鍵 |
| Lightbox 左右滑動 | 上一張／下一張按鈕、`←` `→` |
| Lightbox 雙指縮放 | 放大／縮小／還原按鈕、`+` `-` `0`、雙擊 |
| 手機選單下滑關閉 | 關閉按鈕、`Esc` |

### 2.5.8 目標尺寸（最低，2.2 新增）

門檻是 24×24 CSS 像素，本站實際上以 44px 為準。實測 18 個焦點站點**沒有任何一個低於 24px**。
唯一低於 44px 的是作品集的篩選連結（93×32），仍然合規，記在 `tests/a11y-audit.md` B1-3 當作一致性建議。

後台新元件實測：側邊欄連結 215×70、排序把手 44×44、上移／下移 44×44、Lightbox 控制鈕 54×44（iPhone 13）。

---

## 4. 可理解（Understandable）

### 3.2.6 一致的說明（2.2 新增）

後台原本只有 header 裡一排連結，捲動之後就看不到。現在每一頁都是同一個側邊欄
（`src/app/admin/admin-sidebar.tsx`），項目順序固定，**說明區塊固定在清單最後**，位置在所有頁面都相同。
目前所在的區段用 `aria-current="page"` 標示，`currentAdminSection()` 只讓 `/admin` 匹配它自己，
不會把 `/admin/projects` 也算成首頁。

### 3.3.7 多餘的輸入（2.2 新增）

- 排序不再需要人工重打數字：拖曳／按鈕／鍵盤決定順序後，`sort_order` 由系統依位置寫回，原本的數字欄位保留但不再是唯一途徑。
- 圖片上傳後，寬高由管線量出來並帶回表單的隱藏欄位，編輯者不必再量一次尺寸。
- 雙語欄位只要填一種語言，另一種在儲存時自動沿用（原有行為，保留）。
- 登入表單使用 `autoComplete="username"` / `"current-password"`，讓密碼管理器代填。

### 3.3.4 錯誤預防 + 未儲存變更

- 文章、專案、經歷三個編輯器會比對目前值與最後一次成功儲存的快照，**有差異時**顯示「尚未儲存」徽章，
  同時在 `role="status"` 區域朗讀，離開頁面（重新整理、關閉分頁、站內連結）會跳出確認。
  站內連結是用 capture 階段的 `click` 監聽攔截的，因為 App Router 沒有路由變更事件可掛。
- 所有刪除都要先勾選確認框，送出按鈕在勾選前是 `disabled`。

---

## 5. 穩健（Robust）

### 4.1.3 狀態訊息

| 情境 | 朗讀方式 |
|------|---------|
| Server Action 結果 | 既有的 `<p role="status" aria-live="polite">`（沿用） |
| 排序移動 | 「已下移「X」，現在是第 2 項，共 5 項。」 |
| 抓起／放下／取消 | 「已抓起「X」，用上下方向鍵移動…」／「已放下「X」，位置第 2 項。記得按「儲存排序」。」／「已取消這次移動。」 |
| 排序儲存結果 | 成功與失敗訊息都送進同一個 live region |
| 表單變髒 | 「表單有尚未儲存的變更。」 |
| Lightbox 換圖 | 「2 / 5 · 圖片說明」 |

**刻意不做 live region 的地方**：Markdown 即時預覽。每敲一個字就重播整篇內文對報讀器是災難，
它是一個有 `aria-labelledby` 的 `<section>`，使用者可以主動走訪，但不會被打斷。

---

## 6. 觸控與行動裝置

### 安全區域（瀏海與 Home Indicator）

`src/app/[locale]/layout.tsx` 與 `src/app/admin/layout.tsx` 都輸出
`viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }`，
再由 CSS 把每個貼邊元素推出安全區：

| 元素 | 規則 |
|------|------|
| `.container`（標頭、頁尾、所有頁面內容共用） | `padding-inline: max(20px, env(safe-area-inset-left/right))`（≥640px 為 32px） |
| `.site-header` | `padding-top: env(safe-area-inset-top)` |
| `.site-footer` | `padding-bottom: env(safe-area-inset-bottom)` |
| `.skip-link` | `top: max(12px, env(safe-area-inset-top))`、`left: max(20px, env(safe-area-inset-left))` |
| 手機選單（fixed 覆蓋層） | 四邊都用 `max(…, env(safe-area-inset-*))` |
| Lightbox（fixed 覆蓋層） | 同上 |
| 後台頂欄／側欄 | 同上 |

公開站台的這幾條規則是以 inline `<style>` 寫在 `src/app/[locale]/layout.tsx`，因為 `src/styles/layout.css`
屬於其他工作階段；等那邊合併後應該搬進 `layout.css`。

> 驗證限制：headless Chrome 的 `env(safe-area-inset-*)` 一律回傳 0，無法真的模擬瀏海。
> 驗證方式是確認 meta 為 `width=device-width, initial-scale=1, viewport-fit=cover`、
> 把同一組宣告代入 47px（左右／上）與 34px（下）後量測實際 padding，
> 以及確認 390px 寬沒有水平溢出。
>
> 實測結果：無瀏海時 header `padding-top: 0`、`.container` 左內距 20px、品牌位於 x=20；
> 代入 47px 後 header `padding-top: 47px`、`.container` 47px、品牌移到 (47, 55)、頁尾下內距 34px、
> 水平溢出仍為 0。**真機仍需再看一次。**

### 手勢

- **Lightbox**：雙指縮放（1×–4×）、放大後單指平移、未放大時左右滑動換圖、雙擊切換 1× / 2.5×。
  手勢用 Pointer Events 實作（滑鼠、觸控、觸控筆同一套程式碼）。
  實測（Chrome 觸控模擬 + CDP `Input.dispatchTouchEvent`）：單指左滑 240px → 第一張切到第二張；
  雙指外撐 → `scale(4)`（上限）；滑鼠拖曳 240px 同樣切換到下一張。
- **手機選單**：從捲動位置 0 往下滑超過 96px 即關閉；面板會跟著手指移動再彈回，所以動作有回饋。
  只在 `scrollTop === 0` 時啟動，長選單的捲動不會被誤判成關閉。
  實測：下滑 200px → 關閉；下滑 40px → **維持開啟**；`Esc` → 關閉。
- **不影響滑鼠與鍵盤**：手勢全部是附加的，上面每一條都有按鈕與按鍵的等價操作。

---

## 7. 已知限制

1. **後台登入後的畫面沒有實機驗證**：沒有管理員帳密，middleware 會把 `/admin/*` 全部導向登入頁。
   側邊欄、排序、Markdown 預覽是用一個臨時 dev 路由在真實瀏覽器裡跑過的（驗證後已刪除），
   `aria-current` 的標示只做了程式碼審查。
2. **沒有在 VoiceOver / NVDA 上實跑**，只驗證了 live region 的文字與更新時機。
3. **真實 iPhone 的安全區域**未在實機確認，理由見上。
4. Lightbox 新增控制項的文案尚未進入 `messages/*.json`（那個檔案屬於其他工作階段），
   目前用 `t.has()` 缺鍵時退回硬寫的中／英文。清單在 `tests/a11y-audit.md` B2。
