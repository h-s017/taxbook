# 此域｜報稅記帳簿

小型商號／工作室使用的收入、支出、內帳、外帳、會計科目、現金流與憑證整理 Web App。

目前正式模式已回歸為：

```text
GitHub Pages 靜態網站
        ↓
localStorage 儲存流水帳與設定
        ↓
IndexedDB 儲存附件
```

不需要登入，也不依賴 Supabase。

## 正式網址

```text
https://h-s017.github.io/taxbook/
```

## 資料保存位置

### 流水帳與設定

保存在目前瀏覽器的 `localStorage`：

```text
hanaTaxBookEntries
hanaTaxBookSettings
```

### 收據／發票附件

保存在目前瀏覽器的 IndexedDB：

```text
DB_NAME = hanaTaxBookDB
STORE = receipts
```

GitHub Pages 只保存程式碼，不保存你的帳務資料。

## 核心功能

- 收入
- 支出
- 資產／設備
- 內部移轉
- 外帳
- 內帳
- 外帳＋內帳
- 待確認
- 外帳損益
- 內帳損益
- 內外合併損益
- 已收／已付
- 應收未收
- 應付未付
- 訂金／預收預付
- 依付款方式分析
- 會計科目彙總
- 收據／發票圖片或 PDF
- CSV 匯出
- JSON 備份／匯入
- PWA 基礎離線快取

## 備份非常重要

因為資料只保存在目前瀏覽器：

- 換電腦不會自動同步
- 換手機不會自動同步
- 無痕模式不適合作正式記帳
- 清除瀏覽器網站資料可能刪除帳本
- 重新安裝瀏覽器可能造成資料遺失

建議：

1. 每週匯出完整 CSV
2. 每週備份 JSON
3. 每月匯出外帳 CSV
4. 每月匯出內帳 CSV
5. 原始憑證另行保存

## JSON 備份限制

JSON 主要備份結構化流水帳資料。

附件 binary 儲存在 IndexedDB，不保證包含於 JSON，因此重要收據／發票仍應另外保存。

## GitHub Pages 部署

```text
Settings > Pages
Deploy from a branch
main / root
```

## PWA

目前 `sw.js` 使用 local-only asset cache。

重要前端更新時應 bump cache version，避免瀏覽器持續載入舊 JavaScript。

## 目前正式入口

```text
index.html
↓
app.js
cashflow.js
profitloss.js
```

`js/v2-*` 與 Supabase 相關檔案目前不屬於正式入口，不會由 `index.html` 載入。

## 會計與稅務注意

本工具是記帳與憑證整理工具，不取代會計師、記帳士或國稅局核定。

外帳必須以真實交易與合法憑證為準。內帳用途是經營管理，不應用來隱匿收入或支出。

程式內會計科目代碼屬工具內部分類，不代表官方核定科目表。
