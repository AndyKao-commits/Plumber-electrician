# DOC-09 P0.12 Correction Contract (summary rebuild)

Convert DOC-08 findings into concrete rules:

## P0
1. Quote ↔ repair dependency: explicit FKs and create order (`repair_cases` before quotes that reference them)
2. RLS with every migration batch
3. Emergency purchase immutable quota reserve/release events
4. Petty cash: request → approve → disburse → ledger model
5. Backup/restore: plan validation + drill evidence (RPO1h/RTO4h)

## P1
Tax selection at quote creation time (not only publish), cost method details, permission/finance/test traceability updates.

## Unchanged approved policies
- Final payable threshold NT$3,000
- Emergency single NT$5,000 / daily NT$10,000
- Moving weighted average inventory cost
- Tax mode chosen per quote
- RPO 1h / RTO 4h
