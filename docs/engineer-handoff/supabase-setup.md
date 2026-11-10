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

## 4. LINE 回覆入口（DEC-007｜僅回覆、不主動推播）

系統不會對 LINE 主動 push。使用者傳訊／加好友時，webhook **回覆**功能選單連結。

### Secret（只能放 Supabase）
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- 位置：Supabase → Project Settings → Edge Functions → Secrets
- **禁止**寫入前端、Git、Migration、Cursor 前端 Secrets、錯誤訊息

### 部署
```bash
export SUPABASE_ACCESS_TOKEN=...   # Account Access Token（僅 CLI）
bash scripts/deploy-line-webhook.sh
```

- Edge Function 名稱：`line-webhook`（`--no-verify-jwt`，供 LINE 伺服器呼叫）
- Webhook URL：`https://rhpzvqvkmllbdtkpouwn.supabase.co/functions/v1/line-webhook`
- LINE Developers → Messaging API → 貼上 Webhook URL → Enable → Verify
- 建議關閉 Messaging API 的「自動回應訊息／歡迎訊息」以免與 webhook 搶回覆
- 主流程通知：只寫系統內通知；`safeNotify` **不**呼叫 `line-push`

## 4b. 個人 LINE 綁定（LINE Login 為主）

系統登入仍是 Email／密碼。LINE Login **只做綁定**，寫入 `profiles.line_user_id`。

### LINE Login
1. LINE Developers → LINE Login 頻道  
2. Callback URL 加：`https://plumber-electrician-seven.vercel.app/line-bind-callback`  
3. Supabase Edge Secrets：
   - `LINE_LOGIN_CHANNEL_ID`
   - `LINE_LOGIN_CHANNEL_SECRET`
4. 部署：`bash scripts/deploy-line-login-exchange.sh`  
5. Vercel 環境變數：`VITE_LINE_LOGIN_CHANNEL_ID`（與上相同 Channel ID）→ Redeploy  
6. App「今日團隊」→ **用 LINE 綁定**

### 備援綁定碼
SQL：`20261110_line_bind_code_fix_random.sql`  
流程：產生綁定碼 → LINE 傳「綁定 代碼」。

### Webhook
`line-webhook` 為 **reply-only**（DEC-007）：不 push、不廣播、不主動逾時提醒。  
處理：綁定碼、流程草稿、批次上傳照片、待辦 Flex。請重新 Deploy（JWT 關）。

## 4c. 施工照片（LINE 批次流程）

1. SQL：`supabase/migrations/20261110_line_photo_uploads.sql`
2. SQL：`supabase/migrations/20261110_line_flow_drafts.sql`（草稿狀態機 + `batch_id`／`photo_type`）
3. 重新 Deploy `line-webhook`（JWT 關）
4. 圖文選單「上傳照片」→ **文字訊息** `上傳照片`（不要用網址）
5. 流程：選工地 → 選類型 → 連續傳多張 → 完成／取消  
   逾時僅在「下次使用者操作」時判斷（30 分暫停／24 時清除），不主動推播
6. App 路徑：`/photos`

## 4c-2. 待辦事項（LINE）

1. 圖文選單「待辦事項」→ 文字 `待辦事項`
2. Webhook 即時查 `notices`（open todos），Flex Carousel 顯示；可標記完成（與網站同步）

## 4d. 施工回報與工地串接

1. SQL：`supabase/migrations/20261110_construction_reports.sql`
2. App：`/reports` 施工回報；工地詳情頁顯示照片／採購／報價／回報
3. 圖文選單建議：
   - 上傳照片 → 文字「上傳照片」
   - 待辦事項 → 文字「待辦事項」
   - 我的工地 → `/sites`
   - 出勤打卡 → `/attendance`
   - 採購申請 → `/purchases`
   - 報價管理 → `/quotes`

## 5. 驗證

- Production：登入頁顯示「Supabase 正式模式」
- 確認 RLS：員工不可讀其他組織資料；Member 不可核准／發布

## 現況

- URL 預設 `https://rhpzvqvkmllbdtkpouwn.supabase.co`
- Vercel 需設定 `SUPABASE_ANON_KEY`（及可選 `VITE_SUPABASE_URL`）於 Production／Preview
- 未填 key 時自動回落本機示範模式
