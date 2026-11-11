/**
 * ANA-001: operational stats from confirmed events only; export with masking.
 */
import { canViewCostAndMargin } from './financeSummary'
import { roundMoney } from './money'
import {
  hasPermission,
  PERMISSIONS,
  type SpecRole,
} from './permissions'
import type { UserRole } from './types'

export type OpsStatsInput = {
  issuedBillingTotal: number
  confirmedPaymentsTotal: number
  confirmedRefundsTotal: number
  confirmedUsageCostTotal: number
  openRepairs: number
  closedRepairs: number
  openComplaints: number
  escalatedComplaints: number
}

export type OpsStatsView = {
  billed: number
  cashIn: number
  cashOutRefunds: number
  netCash: number
  /** Masked without finance.cost.read */
  usageCost: number | null
  openRepairs: number
  closedRepairs: number
  openComplaints: number
  escalatedComplaints: number
  costVisible: boolean
  /** Never treat billed/cash as recognized revenue (FIN-10). */
  recognizedRevenue: null
}

export function canExportOpsStats(
  role: UserRole | SpecRole | string,
  financeAuthorized = false,
): boolean {
  return (
    hasPermission(role, PERMISSIONS.TEAM_SUMMARY) ||
    hasPermission(role, PERMISSIONS.FINANCE_READ, { financeAuthorized }) ||
    hasPermission(role, PERMISSIONS.ORG_READ)
  )
}

export function assertCanExportOpsStats(
  role: UserRole | SpecRole | string,
  financeAuthorized = false,
): void {
  if (!canExportOpsStats(role, financeAuthorized)) {
    throw new Error('無權匯出營運統計')
  }
}

/** Only confirmed / issued totals should be passed in by callers. */
export function computeOpsStats(
  input: OpsStatsInput,
  viewer: { role: UserRole | SpecRole | string; financeAuthorized?: boolean },
): OpsStatsView {
  const costVisible = canViewCostAndMargin(
    viewer.role,
    Boolean(viewer.financeAuthorized),
  )
  return {
    billed: roundMoney(input.issuedBillingTotal),
    cashIn: roundMoney(input.confirmedPaymentsTotal),
    cashOutRefunds: roundMoney(input.confirmedRefundsTotal),
    netCash: roundMoney(
      input.confirmedPaymentsTotal - input.confirmedRefundsTotal,
    ),
    usageCost: costVisible
      ? roundMoney(input.confirmedUsageCostTotal)
      : null,
    openRepairs: input.openRepairs,
    closedRepairs: input.closedRepairs,
    openComplaints: input.openComplaints,
    escalatedComplaints: input.escalatedComplaints,
    costVisible,
    recognizedRevenue: null,
  }
}

export function buildOpsStatsCsv(stats: OpsStatsView): string {
  const rows: Array<[string, string]> = [
    ['已開立請款合計', String(stats.billed)],
    ['已確認收款合計', String(stats.cashIn)],
    ['已確認退款合計', String(stats.cashOutRefunds)],
    ['淨現金', String(stats.netCash)],
    [
      '已確認耗用成本',
      stats.costVisible ? String(stats.usageCost ?? 0) : '（遮罩）',
    ],
    ['進行中維修', String(stats.openRepairs)],
    ['已結案維修', String(stats.closedRepairs)],
    ['待處理客訴', String(stats.openComplaints)],
    ['已升級客訴', String(stats.escalatedComplaints)],
    ['認列收入', '政策未決（不匯出）'],
  ]
  return ['指標,數值', ...rows.map(([k, v]) => `${k},${v}`)].join('\n')
}
