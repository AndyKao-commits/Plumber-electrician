# 第一階段資料流盤點與修正結果

分支：`feat/supabase-persistence-and-security`

## 修正前

| 模組 | 來源 |
|---|---|
| 使用者 | 混合 |
| 工地 | 混合 |
| 出勤 | 混合 |
| 採購 | localStorage |
| 報價 | localStorage |
| 庫存 | localStorage |
| 通知 | localStorage |
| 今日團隊 | localStorage（正式模式仍讀 localDb，錯誤） |

## 修正後

| 模組 | 正式模式（有 anon key） | 示範模式（無 key） |
|---|---|---|
| 使用者 | Supabase Auth + profiles | localDb |
| 工地 | Supabase `sites` | localDb |
| 出勤 | Supabase `attendance` | localDb |
| 採購 | Supabase `purchases` + `emergency_limit_events` | localDb |
| 報價 | Supabase `quotations` / `repair_cases` | localDb |
| 庫存 | Supabase `materials` | localDb |
| 通知 | Supabase `notices` | localDb |
| 今日團隊 | Supabase profiles＋出勤摘要 | localDb 摘要 |

規則：正式模式**禁止**回落 localDb；錯誤以繁中顯示。

## 請在線上庫執行

`supabase/migrations/20261110_formal_persistence_security.sql`

（不刪資料；補 RLS、org 觸發器、採購核准欄位、凍結報價保護。）

## 已確認決策（本批）

- **DEC-005**：Admin 可核准採購／發布報價；不自動取得 finance.*／毛利／他人薪資／銀行／門禁。
- **DEC-006**：Member 可盤點（政策）；本批僅入庫＋加權平均＋負庫存阻擋；盤點 UI／過帳下一批。
- Migration 驗證通過後才授權 Vercel 部署；部署前須完整回報檢查表。
