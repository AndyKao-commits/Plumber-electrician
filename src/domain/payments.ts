import { roundMoney } from './money'
import { hasPermission, PERMISSIONS, type SpecRole } from './permissions'
import type {
  AdvanceApplication,
  BillingDocument,
  CustomerAdvance,
  CustomerPayment,
  PaymentAllocation,
  Quotation,
  UserRole,
} from './types'
import { sumIssuedBillingAmount } from './billing'

export const PAYMENT_METHOD_LABELS: Record<CustomerPayment['method'], string> = {
  cash: '現金',
  transfer: '轉帳',
  check: '支票',
  other: '其他',
}

export const PAYMENT_STATUS_LABELS: Record<CustomerPayment['status'], string> = {
  confirmed: '已確認',
  void: '作廢',
}

export function canManagePayments(
  role: UserRole | SpecRole | string,
): boolean {
  return hasPermission(role, PERMISSIONS.PAYMENT_MANAGE)
}

export function assertCanManagePayments(
  role: UserRole | SpecRole | string,
): void {
  if (!canManagePayments(role)) {
    throw new Error('無權管理收款／預收（僅老闆／管理員）')
  }
}

export function canRecordPaymentForQuote(
  quote: Pick<Quotation, 'workflowStatus' | 'deletedAt'>,
): { ok: true } | { ok: false; reason: string } {
  if (quote.deletedAt) return { ok: false, reason: '報價案件已刪除' }
  if (quote.workflowStatus !== 'accepted') {
    return { ok: false, reason: '僅「客戶已接受」的報價可登錄收款／預收' }
  }
  return { ok: true }
}

export function sumConfirmedPayments(
  payments: Array<Pick<CustomerPayment, 'status' | 'amount'>>,
): number {
  let total = 0
  for (const p of payments) {
    if (p.status !== 'confirmed') continue
    total = roundMoney(total + (Number(p.amount) || 0))
  }
  return total
}

export function sumAllocations(
  allocations: Array<Pick<PaymentAllocation, 'amount'>>,
): number {
  return roundMoney(
    allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0),
  )
}

export function sumAdvanceApplications(
  apps: Array<Pick<AdvanceApplication, 'amount'>>,
): number {
  return roundMoney(apps.reduce((s, a) => s + (Number(a.amount) || 0), 0))
}

export function sumOpenAdvances(
  advances: Array<Pick<CustomerAdvance, 'status' | 'remainingAmount'>>,
): number {
  let total = 0
  for (const a of advances) {
    if (a.status !== 'open') continue
    total = roundMoney(total + (Number(a.remainingAmount) || 0))
  }
  return total
}

/** Settled against billing = cash allocations + advance applications (no double cash). */
export function sumSettledOnBilling(input: {
  allocations: Array<Pick<PaymentAllocation, 'amount'>>
  advanceApplications: Array<Pick<AdvanceApplication, 'amount'>>
}): number {
  return roundMoney(
    sumAllocations(input.allocations) +
      sumAdvanceApplications(input.advanceApplications),
  )
}

export function billingDocumentOpenAmount(input: {
  document: Pick<BillingDocument, 'status' | 'amountAfterTax'>
  allocations: Array<Pick<PaymentAllocation, 'amount'>>
  advanceApplications: Array<Pick<AdvanceApplication, 'amount'>>
}): number {
  if (input.document.status !== 'issued') return 0
  const settled = sumSettledOnBilling({
    allocations: input.allocations,
    advanceApplications: input.advanceApplications,
  })
  return roundMoney((Number(input.document.amountAfterTax) || 0) - settled)
}

export function assertAllocationFits(input: {
  paymentAmount: number
  alreadyAllocatedOnPayment: number
  allocating: number
  billingOpenAmount: number
}): void {
  const amt = Number(input.allocating) || 0
  if (amt <= 0) throw new Error('分配金額必須大於 0')
  const nextPay = roundMoney(input.alreadyAllocatedOnPayment + amt)
  if (nextPay > roundMoney(input.paymentAmount) + 0.009) {
    throw new Error('收款分配不可超過已確認收款金額')
  }
  if (amt > roundMoney(input.billingOpenAmount) + 0.009) {
    throw new Error('分配不可超過該請款單尚未清償金額')
  }
}

export function assertAdvanceApplicationFits(input: {
  advanceRemaining: number
  applying: number
  billingOpenAmount: number
}): void {
  const amt = Number(input.applying) || 0
  if (amt <= 0) throw new Error('抵充金額必須大於 0')
  if (amt > roundMoney(input.advanceRemaining) + 0.009) {
    throw new Error('預收抵充不可超過預收剩餘額度')
  }
  if (amt > roundMoney(input.billingOpenAmount) + 0.009) {
    throw new Error('預收抵充不可超過該請款單尚未清償金額')
  }
}

/**
 * Cash collected = confirmed payments only.
 * Advance applications settle billing without adding cash again.
 */
export function cashAndSettlementSummary(input: {
  billingDocuments: Array<Pick<BillingDocument, 'status' | 'amountAfterTax'>>
  payments: Array<Pick<CustomerPayment, 'status' | 'amount'>>
  allocations: Array<Pick<PaymentAllocation, 'amount'>>
  advances: Array<Pick<CustomerAdvance, 'status' | 'remainingAmount' | 'amount'>>
  advanceApplications: Array<Pick<AdvanceApplication, 'amount'>>
}): {
  billed: number
  cashReceived: number
  settledOnBilling: number
  openAdvances: number
  unallocatedCash: number
} {
  const billed = sumIssuedBillingAmount(input.billingDocuments)
  const cashReceived = sumConfirmedPayments(input.payments)
  const settledOnBilling = sumSettledOnBilling({
    allocations: input.allocations,
    advanceApplications: input.advanceApplications,
  })
  const allocatedCash = sumAllocations(input.allocations)
  return {
    billed,
    cashReceived,
    settledOnBilling,
    openAdvances: sumOpenAdvances(input.advances),
    unallocatedCash: roundMoney(cashReceived - allocatedCash),
  }
}
