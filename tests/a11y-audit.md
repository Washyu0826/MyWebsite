# 無障礙稽核紀錄（WCAG 2.2 AA）

日期：2026-09-20　範圍：公開站台（zh / en）＋ `/admin`　方法：鍵盤實測、axe-core 4.10（含 `wcag22a` / `wcag22aa`）、
以螢幕截圖量測實際算繪像素的對比度、Chrome 觸控模擬（iPhone 13）。

本檔只記錄**發現**，特別是需要動到其他工作階段擁有的檔案才能修的項目。已完成的修正與作法寫在 `docs/accessibility.md`。

---

## A. 已在本次修正（本工作階段擁有的檔案）

| # | 準則 | 問題 | 修正位置 |
|---|------|------|----------|
| A1 | 1.4.3 對比 | `.admin-success` `#177245` 在後台的 `--paper` `#0D0E10` 上只有 **3.3:1**，`.admin-error` `#B42318` 只有 **2.94:1**，兩者都是小字，未達 4.5:1。後台沒有掛 next-themes，`:root` 的深色調色盤永遠生效，所以這兩個顏色是為淺色底挑的。 | `src/styles/admin.css`：在 `.admin-shell` 內改用 `#5ED39A`（10.3:1）與 `#FF8A80`（8.5:1） |
| A2 | 1.4.3 對比 | `.admin-button-danger` 是 `#B42318` 底配 `.admin-button` 的 `color: var(--paper)`（近黑），**2.94:1**。 | `src/styles/admin.css`：改為白字，6.6:1 |
| A3 | 2.4.11 焦點不被遮蔽 | 後台新的 sticky top bar 會蓋住捲動後剛取得焦點的元素。 | `src/styles/admin.css`：`.admin-main :focus-visible { scroll-margin-top: 96px }` |
| A4 | 2.5.7 拖曳動作 | 排序原本只能改數字欄位；新的拖曳排序若只有滑鼠拖曳會直接違反 2.5.7。 | `src/app/admin/reorder-list.tsx`：永遠顯示 44px 的「上移／下移」按鈕，另有空白鍵抓起 + 方向鍵的鍵盤流程 |
| A5 | 4.1.3 狀態訊息 | 重新排序、放下、取消、儲存結果沒有任何朗讀。 | `src/app/admin/reorder-list.tsx`：`role="status" aria-live="polite"` 的隱藏區域，每次移動都播報「現在是第 N 項，共 M 項」 |
| A6 | 3.2.6 一致的說明 | 後台每頁的導覽與求助資訊位置不一致（原本只有 header 內的一排連結）。 | `src/app/admin/admin-sidebar.tsx`：每頁同一個側邊欄，說明區塊固定在清單最後 |
| A7 | 2.4.1 略過區塊 | 後台沒有 skip link。 | `src/app/admin/layout.tsx` + `.admin-skip-link` |
| A8 | 1.4.4 / 1.4.10 | iPhone 的 `viewport-fit=cover` 需要，但不能順手關掉縮放。 | `src/app/[locale]/layout.tsx` 與 `src/app/admin/layout.tsx` 的 `viewport` 只設 `width`、`initialScale`、`viewportFit`，**沒有** `maximumScale` / `userScalable` |
| A9 | 2.5.7 + 2.1.1 | Lightbox 的手勢（雙指縮放、左右滑動）若沒有等價操作就違反 2.5.7 與 2.1.1。 | `src/components/image-lightbox.tsx`：上一張／下一張／放大／縮小／還原都是 44px 按鈕，並支援 `←` `→` `+` `-` `0` `Esc` |
| A10 | 2.5.7 | 手機選單新增「下滑關閉」。 | `src/components/mobile-menu.tsx`：關閉按鈕與 `Esc` 保留，手勢只是附加；而且只在捲動位置為 0 時才觸發，避免和捲動衝突 |

---

## B. 需要其他工作階段的檔案才能修

> 這些項目我沒有動，請對應的擁有者處理。

### B1 — `src/styles/layout.css`（版面工作階段）

1. **`.admin-success` / `.admin-error` / `.admin-button-danger` 的根本修正。**
   我只在 `src/styles/admin.css` 以 `.admin-shell` 為前綴覆寫，`layout.css` 裡的原始值仍然是失敗的顏色。若之後有任何頁面在 `.admin-shell` 之外使用這三個 class，對比度會再度掉到 2.9–3.3:1。建議直接把 `layout.css:210-212` 的值換成
   `--admin-ok: #5ED39A` / `--admin-bad: #FF8A80`，並在淺色主題下改用 `#0F5132` / `#8A1C13`。

2. **2.4.11 焦點不被遮蔽（公開站台）。**
   `.site-header` 是 `position: sticky; z-index: 20`，高度約 76px。用 `Tab` 在長頁面往回移動時，瀏覽器只保證把焦點元素捲進視窗，不知道有 sticky header，焦點會被壓在標頭底下。
   建議：`:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible { scroll-margin-top: 96px; scroll-margin-bottom: 24px; }`。
   我已經在 `admin.css` 對後台做了同樣的處理，可以直接照抄。

3. **`.filter-link` 目標尺寸。**
   作品集的篩選連結實測 93×32px。2.5.8（AA）只要求 24×24，所以**沒有違規**，但站上其他互動元素都是 44px，這一個是唯一的例外。若要一致，把 `.filter-link` 的 `min-height` 從 44px 實際生效（目前被 `padding: 8px 14px` 與行高壓到 32px）。

4. **`.skip-link` 與 sticky header 的關係**：實測 `.skip-link` 取得焦點時位在 `z-index: 100`，會蓋在 header 之上而不是被蓋住，**沒有問題**。（自動檢查會把它報成 "obscured"，那是誤判。）

### B2 — `messages/zh.json` / `messages/en.json`（文案工作階段）

Lightbox 新增的控制項需要六個字串。我目前在 `src/components/image-lightbox.tsx` 用 `t.has(key)` 判斷，缺鍵時退回硬寫的中／英文，所以功能是好的，但文案不在翻譯檔裡。請加入 `Projects` 命名空間：

| key | zh | en |
|-----|----|----|
| `previousImage` | 上一張圖片 | Previous image |
| `nextImage` | 下一張圖片 | Next image |
| `zoomIn` | 放大 | Zoom in |
| `zoomOut` | 縮小 | Zoom out |
| `resetZoom` | 還原縮放 | Reset zoom |
| `hint` | 可用雙指縮放、左右滑動切換，或用方向鍵與下方按鈕。 | Pinch to zoom, swipe to change image, or use the arrow keys and the buttons below. |

加進去之後 `image-lightbox.tsx` 的 `fallbacks` 常數就可以整段刪掉。

### B3 — `src/app/[locale]/projects/[slug]/page.tsx`（頁面工作階段）

> 補充：素材庫工作階段已經在 `src/lib/assets/server.ts` 接上 `processUploadImage()` / `saveImageMeta()` /
> `getImageMeta()`，所以**上傳端已經會產生資料**（WebP、去 EXIF、限制尺寸、blur 佔位圖、寫入 `image_metadata`）。
> 還沒接上的只剩**公開頁的讀取端**。

1. **接上模糊佔位圖與尺寸。** 圖片管線現在會把寬高與 blur data URL 寫進 `public.image_metadata`（以公開 URL 為主鍵），讀取方式：

   ```ts
   import { getImageMetaMap } from '@/lib/images';
   const meta = await getImageMetaMap([project.cover_url, ...project.media.map(m => m.url)]);
   // <Image ... {...(meta[url]?.blurDataUrl ? { placeholder: 'blur', blurDataURL: meta[url].blurDataUrl } : {})} />
   ```
   舊圖沒有資料列，`meta[url]` 會是 `undefined`，維持現狀即可（已設計成可降級）。

2. **畫廊滑動切換。** `ImageLightbox` 新增了可選的 `images` prop（`{ src, alt, width, height, blurDataURL }[]`）。目前這一頁每張圖各自 render 一個 lightbox，所以只能縮放不能左右滑。把整個 `images` 陣列傳給每一個 `ImageLightbox`，就會自動啟用左右滑動、`←` `→` 與上一張／下一張按鈕。舊的單張用法完全相容。

### B4 — `src/components/command-palette.tsx`（元件工作階段）

命令面板是固定定位的覆蓋層。`viewport-fit=cover` 之後，iPhone 橫向時它的左右邊會落進瀏海區。建議在最外層容器加上
`padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);`。
我已經對 `mobile-menu.tsx` 與 `image-lightbox.tsx` 做了同樣處理。

### B5 — lint（工具工作階段）

`react-hooks` v7 的新規則在整個 repo 報 21 個問題，其中這些**在我改動之前就存在**，我沒有一併修（不在範圍內、且改動會牽涉 hydration 行為）：

- `src/app/admin/articles/[id]/page.tsx:58` `react-hooks/purity`（`Date.now()`）
- `src/app/admin/articles/article-form.tsx` / `src/app/admin/projects/project-form.tsx` 的 `react-hooks/set-state-in-effect`：那個 effect 是把 UTC 時間換成瀏覽器本地時區，必須在 hydration 之後跑。我只是在同一個 effect 裡多同步了一份 baseline。
- `contact-form.tsx`、`command-palette.tsx`、`cover-preview.tsx`、`letter-reveal.tsx`、`markdown.tsx`、`reveal.tsx`、`theme-switch.tsx` 也各有同類問題。

我自己新增的檔案（`reorder-list.tsx`、`markdown-preview.tsx`、`unsaved-changes.tsx`、`admin-sidebar.tsx`、`images.ts`、
`image-lightbox.tsx`、`mobile-menu.tsx`）在這套規則下是乾淨的。

---

## C. 無法在此次驗證的項目

- **後台登入後的畫面**：沒有管理員帳密，middleware 會把 `/admin/*` 全部導向 `/admin/login`。側邊欄、排序、Markdown 預覽是透過一個臨時的 dev 頁面（驗證後已刪除）在真實瀏覽器裡跑過的；`aria-current="page"` 的標示則只做了程式碼審查與 `currentAdminSection()` 的邏輯檢查。
- **真實 iPhone 的瀏海**：headless Chrome 的 `env(safe-area-inset-*)` 一律回傳 0。驗證方式是確認 `viewport-fit=cover` 有出現在 meta、`max()` 規則確實套用（用相同的宣告代入 47px / 34px 實測），以及 390px 寬時沒有水平溢出。真機仍建議再看一次。
- **螢幕報讀器**：只驗證了 `role="status"` / `aria-live` 區域的文字內容與更新時機，沒有在 VoiceOver / NVDA 上實跑。
