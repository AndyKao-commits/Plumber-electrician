-- Site-scoped cash receipts: optional quote link, received date, confirm sequence.

alter table public.cash_receipt_reports
  add column if not exists quotation_id uuid references public.quotations (id) on delete set null;

alter table public.cash_receipt_reports
  add column if not exists received_on date;

alter table public.cash_receipt_reports
  add column if not exists site_sequence_no integer;

comment on column public.cash_receipt_reports.quotation_id is
  'Optional accepted quote link; quote may be linked later. Progress is amount-based.';
comment on column public.cash_receipt_reports.received_on is
  'Calendar date money was received (Taipei day). Defaults to reported_at date.';
comment on column public.cash_receipt_reports.site_sequence_no is
  'Nth confirmed receipt for this site; assigned on confirm; not renumbered.';

update public.cash_receipt_reports
set received_on = (reported_at at time zone 'Asia/Taipei')::date
where received_on is null;

create index if not exists cash_receipt_reports_site_seq_idx
  on public.cash_receipt_reports (organization_id, site_id, site_sequence_no);

create index if not exists cash_receipt_reports_received_on_idx
  on public.cash_receipt_reports (organization_id, received_on desc);
