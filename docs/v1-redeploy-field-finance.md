# V1.0 field finance / profile / site access — apply & redeploy

## Migrations to apply (Supabase SQL editor or CLI)

Run in order if not already applied:

1. `supabase/migrations/20261111_v1_field_finance.sql`  
   - `expense_reports`, `cash_receipt_reports`, `audit_logs`  
   - profile columns: `nickname`, `birth_date`, `job_title`, `hired_at`, `account_status`, `profile_notes`
2. `supabase/migrations/20261111_org_spend_settings.sql` (if not from prior PR)
3. `supabase/migrations/20261111_site_members_profile.sql`  
   - `site_members` + boss profile update policy

Or apply the concatenated `supabase/apply.sql` on a fresh project.

## Redeploy

1. Redeploy **LINE webhook** edge function after pull (field cash flow writes `expense_reports` / `cash_receipt_reports`):

```bash
supabase functions deploy line-webhook
```

2. Redeploy **web app** (Vercel) from `main` after merge.

3. Confirm rich menu label 「支出／收款」 still points at the existing purchase intent (now field-cash conversation).

## Smoke checks

- LINE：選支出 → 工地 → 項目 → 金額 →（可傳收據）→ 確認；列在網站「收支」
- 員工只見被指派工地；老闆在工地詳情勾選成員
- `/profile` 可改暱稱／生日／工種／到職；老闆可停用帳號
- `/expenses` 回報可多選收據照片
