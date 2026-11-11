-- Misc field cash (加油／餐飲／臨時支援): site optional + free-text location.

alter table public.expense_reports
  alter column site_id drop not null;

alter table public.cash_receipt_reports
  alter column site_id drop not null;

alter table public.expense_reports
  add column if not exists location_text text;

alter table public.cash_receipt_reports
  add column if not exists location_text text;

comment on column public.expense_reports.location_text is
  'Free-text place for misc spend (fuel/meals/etc.) when site_id is null.';
comment on column public.cash_receipt_reports.location_text is
  'Free-text place for misc receipt when site_id is null.';
