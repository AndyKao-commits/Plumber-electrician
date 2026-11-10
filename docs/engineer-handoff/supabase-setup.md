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

## 4. LINE 推播（DEC-007｜正式啟用）

### Secret（只能放 Supabase）
- 名稱：`LINE_CHANNEL_ACCESS_TOKEN`
- 位置：Supabase → Project Settings → Edge Functions → Secrets
- **禁止**寫入前端、Git、Migration、Cursor 前端 Secrets、錯誤訊息

### 部署
```bash
# 先在 SQL Editor 執行：
#   supabase/migrations/20261110_line_outbox_retry.sql
export SUPABASE_ACCESS_TOKEN=...   # Account Access Token（僅 CLI）
bash scripts/deploy-line-push.sh
# 部署後驗證（需 SUPABASE_SERVICE_ROLE_KEY；可選 TEST_EMAIL/TEST_PASSWORD）：
# node scripts/verify-line-push.mjs
```

- Edge Function 名稱：`line-push`
- 流程：主交易成功 → `safeNotify` → `enqueue_line_notifications`（outbox）→ `functions.invoke('line-push')`
- 失敗：不回滾主交易；寫入 `error`；`attempts < 5` 時保持可重試（`pending` + `next_retry_at`）
- 無綁定／無 Token：`skipped`，主流程正常

## 5. 驗證

- Production：登入頁顯示「Supabase 正式模式」
- 確認 RLS：員工不可讀其他組織資料；Member 不可核准／發布

## 現況

- URL 預設 `https://rhpzvqvkmllbdtkpouwn.supabase.co`
- Vercel 需設定 `SUPABASE_ANON_KEY`（及可選 `VITE_SUPABASE_URL`）於 Production／Preview
- 未填 key 時自動回落本機示範模式
