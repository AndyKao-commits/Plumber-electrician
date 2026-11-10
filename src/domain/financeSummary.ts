import { roundMoney } from './money'
import {
  assertCanViewCost,
  hasPermission,
  PERMISSIONS,
  type SpecRole,
} from './permissions'
import type {
  BillingDocument,
  CaseOperatingCost,
  ChangeOrder,
  CustomerCreditNote,
  CustomerPayment,
  CustomerRefund,
  Quotation,
  UserRole,
} from './types'
import { effectiveContractAmountWithChangeOrders } from './changeOrders'
import { balanceReconciliation } from './refunds'

export const OPERATING_COST_KIND_LABELS: Record<
  CaseOperatingCost['kind'],
  string
> = {
  material: '材料成本',
  labor_ops: '施工營運成本',
  other: '其他已確認成本',
}

export const OPERATING_COST_STATUS_LABELS: Record<
  CaseOperatingCost['status'],
  string
> = {
  confirmed: '已確認',
  void: '作廢',
}

/** Owner（或額外授權）可登錄已確認營運成本；Admin 預設無 finance.write。 */
export function canRecordOperatingCost(
  role: UserRole | SpecRole | string,
  financeAuthorized = false,
): boolean {
  return hasPermission(role, PERMISSIONS.FINANCE_WRITE, { financeAuthorized })
}

export function assertCanRecordOperatingCost(
  role: UserRole | SpecRole | string,
  financeAuthorized = false,
): void {
  if (!canRecordOperatingCost(role, financeAuthorized)) {
    throw new Error('無權登錄營運成本（需 finance.write／老闆）')
  }
}

export function canViewCostAndMargin(
  role: UserRole | SpecRole | string,
  financeAuthorized = false,
): boolean {
  return (
    hasPermission(role, PERMISSIONS.FINANCE_COST_READ, { financeAuthorized }) ||
    hasPermission(role, PERMISSIONS.SENSITIVE_MARGIN, { financeAuthorized })
  )
}

export function sumConfirmedOperatingCosts(
  costs: Array<Pick<CaseOperatingCost, 'status' | 'amount'>>,
): number {
  let total = 0
  for (const c of costs) {
    if (c.status !== 'confirmed') continue
    total = roundMoney(total + (Number(c.amount) || 0))
  }
  return total
}

export function assertOperatingCostAmount(amount: number): void {
  const amt = Number(amount) || 0
  if (amt < 0) throw new Error('營運成本不可為負')
  // 免費保固／客戶收費為 0 仍可記 0 以外的成本；金額本身可為 0（僅備註）但通常 > 0
  if (amt === 0) throw new Error('營運成本金額必須大於 0（免費案件亦保留內部成本）')
}

/**
 * FIN-006／FIN-09／FIN-10：
 * - 帳款、現金、成本分開
 * - 不把請款或收款當認列收入
 * - 免費保固：客戶收費可為 0，內部成本仍保留
 * - 毛利僅在有成本權限時揭露，且標示為「相對合約的示意差額」非已實現利潤
 */
export type CaseFinanceSummary = {
  contract: number
  billed: number
  credited: number
  netReceivable: number
  cashIn: number
  cashOutRefunds: number
  netCash: number
  /** 已確認營運成本；無權限時為 null */
  confirmedCost: number | null
  /** 合約 − 成本（示意）；無權限時為 null。不可冒充已實現毛利。 */
  indicativeMarginVsContract: number | null
  /** 會計收入認列政策未決 → 永遠為 null */
  recognizedRevenue: null
  revenueRecognition: 'not_applicable'
  costVisible: boolean
  warrantyFreeCase: boolean
}

export function computeCaseFinanceSummary(input: {
  quotes: Array<Pick<Quotation, 'workflowStatus' | 'amountAfterTax'>>
  changeOrders: Array<Pick<ChangeOrder, 'status' | 'kind' | 'amountAfterTax'>>
  billingDocuments: Array<Pick<BillingDocument, 'status' | 'amountAfterTax'>>
  payments: Array<Pick<CustomerPayment, 'status' | 'amount'>>
  creditNotes: Array<Pick<CustomerCreditNote, 'status' | 'amount'>>
  refunds: Array<Pick<CustomerRefund, 'status' | 'amount'>>
  operatingCosts: Array<Pick<CaseOperatingCost, 'status' | 'amount' | 'warrantyFree'>>
  viewer: {
    role: UserRole | SpecRole | string
    financeAuthorized?: boolean
  }
}): CaseFinanceSummary {
  const contract = effectiveContractAmountWithChangeOrders({
    quotes: input.quotes,
    changeOrders: input.changeOrders,
  })
  const bal = balanceReconciliation({
    contract,
    billingDocuments: input.billingDocuments,
    payments: input.payments,
    creditNotes: input.creditNotes,
    refunds: input.refunds,
  })
  const costVisible = canViewCostAndMargin(
    input.viewer.role,
    Boolean(input.viewer.financeAuthorized),
  )
  const confirmedCost = sumConfirmedOperatingCosts(input.operatingCosts)
  const warrantyFreeCase =
    roundMoney(contract) === 0 &&
    input.operatingCosts.some(
      (c) => c.status === 'confirmed' && (c.warrantyFree || confirmedCost > 0),
    )

  if (!costVisible) {
    return {
      ...bal,
      confirmedCost: null,
      indicativeMarginVsContract: null,
      recognizedRevenue: null,
      revenueRecognition: 'not_applicable',
      costVisible: false,
      warrantyFreeCase,
    }
  }

  return {
    ...bal,
    confirmedCost,
    indicativeMarginVsContract: roundMoney(contract - confirmedCost),
    recognizedRevenue: null,
    revenueRecognition: 'not_applicable',
    costVisible: true,
    warrantyFreeCase,
  }
}

export function assertViewerMaySeeCost(
  role: UserRole | SpecRole | string,
  financeAuthorized = false,
): void {
  assertCanViewCost(role, financeAuthorized)
}
