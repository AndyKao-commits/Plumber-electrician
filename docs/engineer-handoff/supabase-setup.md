# Supabase 接線說明

專案 URL：`https://rhpzvqvkmllbdtkpouwn.supabase.co`

## 1. 必要密鑰

應用讀取 `SUPABASE_ANON_KEY`（Cursor Secrets）或本機 `VITE_SUPABASE_ANON_KEY`。  
**不要**把 service_role key 放進前端。

## 2. 套用資料庫（重要順序）

在 Supabase Dashboard → **SQL Editor**：

### 建議（一次完成）

貼上並執行整份：

`supabase/apply.sql`

（內含 schema + seed，可重跑；會先建 `organizations` 等表再寫入示範資料。）

### 或分兩步

1. 先跑 `supabase/schema.sql`（建表／RLS）
2. 再跑 `supabase/seed.sql`（示範資料）

若只跑 seed 會出現：

`relation "public.organizations" does not exist`

這代表表還沒建好，請改跑 `apply.sql` 或先跑 `schema.sql`。

## 3. 建立登入帳號

Dashboard → Authentication → Users：建立 Email／密碼使用者。  
再於 `profiles` 寫入對應列（`id` 必須等於 `auth.users.id`，並指向同一 `organization_id`）。

## 4. 已上線資料庫的安全補強

若先前已跑過舊版 schema，請再執行一次：

`supabase/fix_rls_security.sql`

（鎖定 role／finance／organization 不可自改，寫入必須同組織。）

## 5. 驗證

- 本機：設定 anon key 後 `npm run dev`，登入頁應顯示「Supabase」
- 確認 RLS：員工不可讀其他組織資料；不可自我提權

## 現況

- URL 已寫入預設設定
- anon key 待 Owner 在安全表單填入後才會真正連線
- 未填 key 時自動回落本機示範模式
