# DOC-04 Permissions & Security (summary rebuild)

## Model
- Equal project operations for all valid org members
- Extra authorization for: purchase approval over threshold, finance read/manage, others payroll, access codes, backup admin
- Roles (`boss`/`employee`) are labels; not the sole gate for field work

## Visible vs protected
- Visible to team: quotes, material unit prices, purchase amounts, today’s on-duty presence, project participation
- Protected: margin/profit, company-wide finance, other people’s punch details/efficiency/payroll

## Security requirements (DOC-08/09)
- RLS + `organization_id` on every batch of tables
- No cross-org access via API parameter spoofing
- Audit events for sensitive mutations
- Notifications are in-app only (no proactive LINE push)
