# 文章修訂與還原

每次成功儲存文章，系統都會保留當時的內容。你可以看到每一版改了哪些欄位、逐行比較舊版與現在的差異，並把任何一版還原回來。還原一律先轉成草稿，不會直接對外發布。

## 怎麼用

在 `/admin/articles/<id>` 的「修訂紀錄」區：

1. 每一列是一個版本，顯示版號、時間、原因（儲存／還原），以及與前一版相比變更了哪些欄位。
2. **與目前比較**：展開逐行差異。左邊行號是舊版，右邊是目前內容；紅色是舊版有、現在沒有的行，綠色是現在才有的行。連續 3 行以上沒變動的部分會摺疊成「略過 N 行未變更」。
3. **還原此版**：確認後，系統會先把目前的內容也存成一個修訂版本（所以還原本身可以再還原），再把該版寫回文章，並把狀態改為草稿。你檢查完再自行發布。

網址代稱（slug）也會一起還原。如果那個 slug 已經被別篇文章佔用，會保留目前的 slug 並在訊息裡說明，不會讓兩篇文章撞網址。

## 什麼會被保留

快照包含編輯器管得到的所有欄位：中英標題、slug、狀態、發布時間、中英摘要、中英內文、封面網址與中英替代文字、標籤、閱讀時間。不含 `id`、`created_at`、`updated_at` 這類系統欄位。

- 內容完全相同時不會新增版本，所以連按兩次儲存不會灌水。比對是 jsonb 值比對，欄位順序不同不算變更。
- 沒有修訂紀錄的舊文章，第一次編輯時會先把「編輯前」的內容補存為第 1 版，所以那一次編輯也救得回來。
- 刪除文章時，它的修訂會一併刪除（外鍵 cascade）。目前沒有文章層級的垃圾桶。
- 沒有自動清理或保留期限。修訂會一直累積；內文很長又改很多次時會占資料庫空間，需要時再加保留政策。

## 與素材庫的關係

`asset_references()` 會把「某篇文章的舊版本仍引用這個公開副本」列為 **soft** 引用：

- **硬引用**（現在的個人資料、作品、畫廊、文章）會擋住回收與撤銷公開副本。
- **soft 引用**（只存在於舊版本）不會擋，但素材詳情會列出警告：撤銷之後再還原那些版本，圖片會失效。

這是刻意的取捨。舊版本永遠保留的話，任何用過的圖都再也撤不掉；完全忽略舊版本的話，還原會默默壞掉。所以選擇不擋、但講清楚。

## 資料庫

`supabase/migrations/20260920000500_post_revisions.sql`：

- `post_revisions` 表：`post_id`、`revision`（每篇文章從 1 遞增，`unique(post_id, revision)`）、`snapshot` jsonb、`actor_id`、`reason`（`save` / `restore`）、`created_at`。啟用 RLS，anon 與 authenticated 完全無權限，只有 service role 可讀寫。
- `post_save_revision(actor, post, snapshot, reason)`：在文章列鎖定下取得下一個版號；快照與最新版相同時回傳既有那筆，不重複寫入。
- 同時取代 `asset_references()` 與 `asset_change()` / `asset_revoke_publication()`，加入上面說的 soft 引用規則。

**這個 migration 尚未套用到正式 Supabase。** 套用前先備份。沒有套用時，修訂區塊會顯示「還沒有修訂紀錄」，儲存文章仍正常運作（寫入修訂失敗不會讓儲存失敗），還原與比較則會回報需要套用 migration。

## 驗證

```powershell
npx tsx --test tests/diff.test.ts                              # 差異演算法
npx vitest run tests/components/article-revisions.test.tsx     # 修訂介面
node scripts/test-assets-sql.mjs                               # 含 tests/sql/post-revisions.test.sql
```

差異演算法是純函式（`src/lib/diff.ts`，逐行 LCS），涵蓋插入、刪除、修改、空字串、CRLF、雙側行號、超長文字的退化處理，以及摺疊未變更區塊。資料庫測試涵蓋版號遞增、相同快照去重、欄位順序無關、輸入驗證、權限、cascade 刪除，以及 soft 引用不擋回收。
