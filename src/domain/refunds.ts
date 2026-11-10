import { roundMoney } from './money'
import { hasPermission, PERMISSIONS, type SpecRole } from './permissions'
import type {
  BillingDocument,
  CustomerCreditNote,
  CustomerPayment,
  CustomerRefund,
  Quotation,
  UserRole,
} from './types'
import { sumIssuedBillingAmount } from './billing'
import {
  canManagePayments,
  sumConfirmedPayments,
} from './payments'

export const CREDIT_NOTE_STATUS_LABELS: Record<
  CustomerCreditNote['status'],
  string
> = {
  issued: '已開立',
  void: '作廢',
}

export const REFUND_STATUS_LABELS: Record<CustomerRefund['status'], string> = {
  confirmed: '已退款',
  void: '作廢',
}

export function canManageRefunds(
  role: UserRole | SpecRole | string,
): boolean {
  return (
    canManagePayments(role) || hasPermission(role, PERMISSIONS.PAYMENT_MANAGE)
  )
}

export function assertCanManageRefunds(
  role: UserRole | SpecRole | string,
): void {
  if (!canManageRefunds(role)) {
    throw new Error('無權管理折讓／退款（僅老闆／管理員）')
  }
}

export function canIssueCreditOrRefund(
  quote: Pick<Quotation, 'workflowStatus' | 'deletedAt'>,
): { ok: true } | { ok: false; reason: string } {
  if (quote.deletedAt) return { ok: false, reason: '報價案件已刪除' }
  if (quote.workflowStatus !== 'accepted') {
    return { ok: false, reason: '僅「客戶已接受」的報價可開立折讓／退款' }
  }
  return { ok: true }
}

export function sumIssuedCredits(
  notes: Array<Pick<CustomerCreditNote, 'status' | 'amount'>>,
): number {
  let total = 0
  for (const n of notes) {
    if (n.status !== 'issued') continue
    total = roundMoney(total + (Number(n.amount) || 0))
  }
  return total
}

export function sumConfirmedRefunds(
  refunds: Array<Pick<CustomerRefund, 'status' | 'amount'>>,
): number {
  let total = 0
  for (const r of refunds) {
    if (r.status !== 'confirmed') continue
    total = roundMoney(total + (Number(r.amount) || 0))
  }
  return total
}

export function refundsOnPayment(
  paymentId: string,
  refunds: Array<Pick<CustomerRefund, 'paymentId' | 'status' | 'amount'>>,
): number {
  return sumConfirmedRefunds(
    refunds.filter((r) => r.paymentId === paymentId),
  )
}

export function assertCreditNoteFits(input: {
  billed: number
  alreadyCredited: number
  crediting: number
}): void {
  const amt = Number(input.crediting) || 0
  if (amt <= 0) throw new Error('折讓金額必須大於 0')
  const next = roundMoney(input.alreadyCredited + amt)
  if (next > roundMoney(input.billed) + 0.009) {
    throw new Error('折讓合計不可超過已開立請款金額（避免重複扣減）')
  }
}

export function assertRefundFits(input: {
  paymentAmount: number
  alreadyRefundedOnPayment: number
  refunding: number
}): void {
  const amt = Number(input.refunding) || 0
  if (amt <= 0) throw new Error('退款金額必須大於 0')
  const next = roundMoney(input.alreadyRefundedOnPayment + amt)
  if (next > roundMoney(input.paymentAmount) + 0.009) {
    throw new Error('退款不可超過該筆原收款金額（原收款紀錄保留）')
  }
}

/**
 * 餘額核對：合約／請款／折讓／現金／退款分開，不把差額當已實現毛利。
 */
export function balanceReconciliation(input: {
  contract: number
  billingDocuments: Array<Pick<BillingDocument, 'status' | 'amountAfterTax'>>
  payments: Array<Pick<CustomerPayment, 'status' | 'amount'>>
  creditNotes: Array<Pick<CustomerCreditNote, 'status' | 'amount'>>
  refunds: Array<Pick<CustomerRefund, 'status' | 'amount'>>
}): {
  contract: number
  billed: number
  credited: number
  netReceivable: number
  cashIn: number
  cashOutRefunds: number
  netCash: number
} {
  const billed = sumIssuedBillingAmount(input.billingDocuments)
  const credited = sumIssuedCredits(input.creditNotes)
  const cashIn = sumConfirmedPayments(input.payments)
  const cashOutRefunds = sumConfirmedRefunds(input.refunds)
  return {
    contract: roundMoney(input.contract),
    billed,
    credited,
    netReceivable: roundMoney(billed - credited),
    cashIn,
    cashOutRefunds,
    netCash: roundMoney(cashIn - cashOutRefunds),
  }
}
