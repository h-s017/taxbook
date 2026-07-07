# 此域｜報稅記帳簿

小型商號／工作室使用的收入、支出、內帳、外帳、會計科目、現金流與憑證整理 Web App。前端部署於 GitHub Pages，Supabase 是主要雲端資料來源。

## 目前架構

```text
GitHub Pages frontend
        ↓
Supabase Auth
        ↓
Supabase PostgreSQL
        ↓
Supabase private Storage
```

目前正式 Supabase project ref：

```text
fomxcpizeonovubegfio
```

舊 project `dgsdfgikoyhxtdskjkrj` 已停用，不應再用於 TaxBook。

## 核心資料表

- `profiles`
- `companies`
- `company_members`
- `accounting_accounts`
- `projects`
- `cash_accounts`
- `transactions`
- `attachments`
- `transaction_cash_flows`

每筆交易獨立存成 `transactions` row，不再使用整包 JSON 覆蓋同步。

## 核心功能

- 收入、支出、資產／設備、內部移轉
- 外帳、內帳、外帳＋內帳、待確認
- 外帳損益、內帳損益、內外合併損益
- 已收／已付、應收未收、應付未付、訂金／預收預付
- 依付款方式分析
- 依資金帳戶記錄
- 內部轉帳：轉出帳戶與轉入帳戶各自產生現金流 row，不進損益
- 會計科目
- 專案
- 收據／發票圖片或 PDF
- CSV 匯出
- JSON 備份
- PWA 基礎離線快取
- 本機 pending queue

## Supabase Auth 設定

Supabase Dashboard：

```text
Authentication > URL Configuration
```

必須設定：

```text
Site URL:
https://h-s017.github.io/taxbook/

Redirect URLs:
https://h-s017.github.io/taxbook/
```

前端 Magic Link 也使用：

```text
https://h-s017.github.io/taxbook/
```

若 Email Template 仍固定使用 `{{ .SiteURL }}`，請確認 Site URL 已不是 localhost；需要依 redirectTo 回跳時，可檢查模板是否應改用 `{{ .RedirectTo }}`。

## Email rate limit / SMTP

Supabase 預設 SMTP 僅適合測試，寄信頻率有限。Auth logs 若出現：

```text
over_email_send_rate_limit
429 email rate limit exceeded
```

請不要自動重試。正式使用建議設定 Custom SMTP。

目前 repo 不包含 SMTP 密碼、service role key 或其他 secret。

## Supabase key

前端只允許：

- publishable key
- legacy anon key

禁止放入：

- service role key
- database password
- SMTP password
- private secret

## RLS

所有核心 public tables 應啟用 Row Level Security。

目前使用 company membership / owner-based access：

- 使用者只能讀取自己有權限的 company
- transaction 必須屬於可存取 company
- transaction insert 的 `user_id` 應對應 `auth.uid()`
- attachments、cash accounts、cash flows 必須依 company 隔離

每次修改 schema 或 policy 後，請執行 Supabase Security Advisors。

## Storage

Bucket：

```text
receipts
```

必須是 private bucket。

目前附件 path：

```text
user_id/company_id/transaction_id/file_name
```

附件不可使用永久 public URL；下載使用 authenticated Storage API。

## 公司與角色

支援：

- `owner`
- `admin`
- `accountant`
- `editor`
- `viewer`

前端載入公司時會優先讀 `company_members`；若 membership 尚未建立，才 fallback 到 owner company。

## 現金流

`payment_method` 與 `cash_account_id` 是不同概念。

例如：

```text
payment_method = 轉帳
cash_account = 玉山銀行
```

或：

```text
payment_method = 刷卡
cash_account = 國泰信用卡
```

內部移轉會建立兩筆 `transaction_cash_flows`：

```text
from account → out
into account → in
```

不計入損益。

## 舊資料 migration

舊流水帳可能存在：

```text
localStorage
hanaTaxBookEntries
```

App 可將舊資料逐筆寫入 `transactions`。舊非 UUID id 應轉成新 UUID；原本 localStorage 不應自動刪除。

舊附件可能存在：

```text
IndexedDB
DB_NAME = hanaTaxBookDB
STORE = receipts
```

目前舊 IndexedDB 附件的完整自動 migration 仍屬待完成項目。

## Offline queue

離線新增／修改會先進本機 pending queue。重新連線後可同步。

仍需持續強化：

- pending
- error
- conflict
- retry
- 更完整的衝突 UI

## Conflict handling

交易使用 `updated_at`。修改既有交易前應比較 remote `updated_at`，避免舊裝置靜默覆蓋較新的雲端版本。

目前前端已有基本衝突提示；仍建議補完整的三選項 UX：

- 重新載入雲端版本
- 保留本機修改
- 取消

## GitHub Pages

正式網址：

```text
https://h-s017.github.io/taxbook/
```

部署：

```text
Settings > Pages
Deploy from a branch
main / root
```

## PWA

`sw.js` 需在每次重要前端更新後 bump cache version，避免手機持續使用舊 JavaScript。

## 備份

建議：

1. 每週匯出完整 CSV
2. 每週備份 JSON
3. 每月匯出外帳 CSV 與內帳 CSV
4. 原始發票／收據另外保存

JSON 備份主要包含結構化資料與附件 metadata；不保證包含附件 binary。

## 會計與稅務注意

本工具是記帳與憑證整理工具，不取代會計師、記帳士或國稅局核定。

外帳必須以真實交易與合法憑證為準。內帳用途是經營管理，不應用來隱匿收入或支出。

程式內會計科目代碼屬工具內部分類，不代表官方核定科目表。
