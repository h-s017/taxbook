# 此域｜報稅記帳簿

小型商號／工作室使用的收入、支出、內帳、外帳、會計科目、收據與發票整理 Web App。可部署於 GitHub Pages，並可選擇使用 Supabase 做手機與電腦同步。

## 核心原則

本工具採用「同一筆交易，兩種視圖」：

- **外帳**：給報稅、會計師、記帳士整理使用，必須以真實交易與合法憑證為準。
- **內帳**：給經營管理使用，例如此域開幕、KPIA課程、Helori體驗、H.FUGUE產品、私人代墊待沖等。

請勿把內帳與外帳做成互相矛盾的兩套帳。內帳應作為經營分析與備註標籤，不應用來隱匿收入或支出。

## 功能

- 收入、支出、資產設備、內部移轉流水帳
- 帳務視圖：外帳＋內帳、只列外帳、只列內帳、待會計確認
- 詳細會計科目：收入、成本、費用、資產、押金、業主往來等
- 內帳用途標籤：此域開幕籌備、此域固定營運、KPIA課程、Helori體驗、H.FUGUE產品、企業合作、補助等
- 收據、發票照片或 PDF 上傳
- 憑證類型管理：電子發票、三聯式、二聯式、收據、電商交易紀錄、銀行/刷卡紀錄、內部憑證、無憑證待補
- 憑證狀態：完整、待補、僅照片待整理、待確認
- 現金流狀態：已收/已付、應收未收、應付未付、訂金/預收預付
- 年度外帳收入、外帳支出、損益、待確認統計
- 月報表
- 會計科目彙總表
- 小規模營業人進項稅額 10% 扣減估算欄
- 完整 CSV、外帳 CSV、內帳 CSV 分開匯出
- 完整 CSV 會包含附件有無、檔名、類型與雲端路徑 metadata
- JSON 備份與匯入
- Supabase 雲端同步：流水帳與收據／發票附件
- PWA 基礎離線快取

## 手機與電腦同步設定

GitHub Pages 只能託管 HTML、CSS、JavaScript 靜態檔案；同步資料需要另外接雲端後端。本工具使用 Supabase：

- Supabase Auth：用 Email 魔法連結登入
- Supabase Database：保存流水帳 JSON
- Supabase Storage：保存收據、發票照片或 PDF

安全提醒：

- 前端只能填 Supabase Project URL 與 anon / publishable key，不可使用 service role key。
- GitHub repo 不應提交任何使用者流水帳、發票、收據、匯出的 JSON/CSV，或 Supabase secret key。
- `receipts` Storage bucket 必須是 private bucket。
- App 上傳附件時會使用 `user.id/entry.id/filename` 路徑；SQL policy 會限制登入者只能讀寫自己 `user.id` 開頭的檔案。
- 目前同步是手動整包同步，不是即時雙向合併。上傳會覆蓋雲端；下載會覆蓋本機。操作前 App 會顯示本機與雲端的新舊時間與備份提醒。

### 1. 建立 Supabase 專案

到 Supabase 建立一個新 project。

### 2. 設定 Auth 網址

Supabase 後台：

```text
Authentication > URL Configuration
```

設定：

```text
Site URL: https://h-s017.github.io/taxbook/
Redirect URLs: https://h-s017.github.io/taxbook/
```

### 3. 建立 private Storage bucket

Supabase 後台：

```text
Storage > New bucket
```

設定：

```text
Bucket name: receipts
Public bucket: OFF
```

也可以直接執行 `supabase-setup.sql`，SQL 會嘗試建立或修正 `receipts` bucket 為 private。如果 Supabase 權限不允許 SQL 建 bucket，請改用後台手動建立。

### 4. 執行 SQL

打開 Supabase SQL Editor，把 repo 內的 `supabase-setup.sql` 全部貼上執行。

這會建立：

- `taxbook_records` 資料表
- Row Level Security
- 只允許本人讀寫自己的記帳資料
- `receipts` bucket 的本人附件讀寫規則

若 SQL 顯示 policy 已存在或 bucket 已存在，可重新執行；檔案中的 policy 會先 drop 再 create。

### 5. 複製 Supabase 設定到 Web App

Supabase 後台：

```text
Project Settings > API
```

複製：

- Project URL
- anon key / publishable key

貼到 Web App 的「手機／電腦雲端同步」區塊。

### 6. 登入與同步

1. 輸入 Email
2. 按「寄登入連結」
3. 到信箱點登入連結
4. 回到 Web App
5. 按「上傳到雲端」或「從雲端下載」

建議流程：

- 主要輸入裝置：按「上傳到雲端」
- 另一台裝置：登入後按「從雲端下載」
- 每次大量新增資料後，手動按一次「上傳到雲端」
- 下載雲端資料前，若本機已有資料，建議先按「備份 JSON」。
- 若 App 顯示雲端資料比本機新，請先確認另一台裝置是否剛上傳過，避免用舊資料覆蓋。
- JSON 備份不包含附件影像/PDF；附件請保留原始檔，或透過 Supabase private Storage 同步。

## 目前內建會計科目

### 收入類

- 4110 銷貨收入
- 4120 勞務收入／課程收入
- 4130 顧問／設計服務收入
- 4140 活動／企業合作收入
- 4190 其他營業收入

### 成本與費用類

- 5110 進貨／原物料成本
- 5120 包材／容器成本
- 5130 課程材料成本
- 5140 商品進貨成本
- 5210 薪資支出／外包勞務
- 5220 租金支出
- 5230 水電瓦斯費
- 5240 郵電費／網路費
- 5250 文具用品／辦公費
- 5260 旅費／交通費
- 5270 運費
- 5280 廣告行銷費
- 5290 平台手續費／刷卡手續費
- 5310 修繕費
- 5320 保險費
- 5330 稅捐／規費
- 5340 交際費
- 5350 訓練費／進修費
- 5360 雜項購置
- 5390 其他費用

### 資產與往來類

- 1410 存貨
- 1510 生財器具／設備
- 1520 租賃改良／裝修
- 1910 押金／保證金
- 1110 現金
- 1120 銀行存款
- 2180 業主往來／代墊
- 2190 其他應付／內部移轉

## 重要資料保存說明

這是純前端靜態工具。

未設定 Supabase 時：

- 流水帳資料：儲存在瀏覽器 localStorage
- 收據／發票附件：儲存在瀏覽器 IndexedDB
- 資料不會上傳到 GitHub
- 換手機、換瀏覽器、清除瀏覽器資料、使用無痕模式，都可能造成資料或附件遺失

設定 Supabase 後：

- 手動按「上傳到雲端」才會同步
- 手動按「從雲端下載」才會覆蓋目前裝置的本機資料
- 收據與發票附件會同步到 private Storage bucket

建議做法：

1. 每週匯出完整 CSV
2. 每週備份 JSON
3. 每月另外匯出外帳 CSV 與內帳 CSV
4. 發票與收據原始檔另外存到 Google Drive、iCloud、OneDrive 或電腦資料夾
5. 檔名建議：`YYYY-MM-DD_廠商或客戶_金額_用途`

例如：

```text
2026-07-03_香精材料行_3200_KPIA材料.jpg
2026-07-05_北投中心新村_9000_租金.pdf
```

## GitHub Pages 部署

1. 到 repo 的 Settings
2. 點 Pages
3. Source 選 `Deploy from a branch`
4. Branch 選 `main`
5. Folder 選 `/root`
6. Save

部署完成後，網址通常會是：

```text
https://h-s017.github.io/taxbook/
```

## 報稅注意

本工具是記帳與憑證整理工具，不取代會計師、記帳士或國稅局核定。

使用前請確認：

- 實際稅籍型態
- 是否為小規模營業人
- 是否免用統一發票
- 是否有使用統一發票
- 哪些支出憑證可列帳或扣減
- 設備、裝修、押金是否應列資產或費用
- 內部移轉、業主代墊、私人支出是否需要另外沖帳

## 建議使用流程

每次有收入或支出時：

1. 輸入日期
2. 選收入、支出、資產設備或內部移轉
3. 選帳務視圖
4. 選會計科目
5. 選內帳用途標籤
6. 輸入交易對象、金額、憑證號碼
7. 設定是否可列外帳／報稅
8. 上傳收據或發票照片
9. 儲存
10. 有需要同步時，按「上傳到雲端」

每月底：

1. 檢查「待補／待確認」
2. 匯出完整 CSV
3. 匯出外帳 CSV 給會計或記帳士
4. 匯出內帳 CSV 做經營分析
5. 備份 JSON
6. 檢查 Google Drive 或電腦是否有保存原始憑證

每季：

1. 檢查進項稅額
2. 整理可申報的進項憑證
3. 交由會計／記帳士或依國稅局規定處理
