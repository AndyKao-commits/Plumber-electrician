# Supabase 接線說明

專案 URL：`https://rhpzvqvkmllbdtkpouwn.supabase.co`

## 1. 必要密鑰

應用讀取 `SUPABASE_ANON_KEY`（Cursor Secrets）或本機 `VITE_SUPABASE_ANON_KEY`。  
**不要**把 service_role key 放進前端。

## 2. 套用 schema

在 Supabase Dashboard → SQL Editor 依序執行：

1. `supabase/schema.sql`
2. （可選）`supabase/seed.sql`

## 3. 建立登入帳號

Dashboard → Authentication → Users：建立 Email／密碼使用者。  
再於 `profiles` 寫入對應列（`id` 必須等於 `auth.users.id`，並指向同一 `organization_id`）。

## 4. 驗證

- 本機：設定 anon key 後 `npm run dev`，登入頁應顯示「Supabase」而非「本機示範」
- 確認 RLS：以員工帳號不可讀其他組織資料

## 現況

- URL 已寫入預設設定
- anon key 待 Owner 在安全表單填入後才會真正連線
- 未填 key 時自動回落本機示範模式
