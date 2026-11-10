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

### Phase 1／3／4 增量 migration（正式環境已上線後）

依序執行：

1. `supabase/migrations/20261110_formal_persistence_security.sql`
2. `supabase/migrations/20261110_phase3_line_notify.sql`
3. 驗證：`supabase/verify_rls_one_shot.sql`  
   期望：`rls_enabled=11`、`org_triggers=9`、`line_bind_grant=true`、notice/line RPCs 皆 true

若只跑 seed 會出現：

`relation "public.organizations" does not exist`

這代表表還沒建好，請改跑 `apply.sql` 或先跑 `schema.sql`。

## 3. 建立登入帳號

Dashboard → Authentication → Users：建立 Email／密碼使用者。  
再於 `profiles` 寫入對應列（`id` 必須等於 `auth.users.id`，並指向同一 `organization_id`）。

## 4. LINE 推播（可選｜DEC-007）

1. 部署 Edge Function：`supabase/functions/line-push`
2. 設定 Secret：`LINE_CHANNEL_ACCESS_TOKEN`
3. 使用者在「今日團隊」頁綁定自己的 `line_user_id`
4. 未設定 Token 時 outbox 會標 `skipped`，主交易仍成功

## 5. 驗證

- Production：登入頁顯示「Supabase 正式模式」
- 確認 RLS：員工不可讀其他組織資料；Member 不可核准／發布

## 現況

- URL 預設 `https://rhpzvqvkmllbdtkpouwn.supabase.co`
- Vercel 需設定 `SUPABASE_ANON_KEY`（及可選 `VITE_SUPABASE_URL`）於 Production／Preview
- 未填 key 時自動回落本機示範模式
