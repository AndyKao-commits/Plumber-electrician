/**
 * V1.0 field finance: employee expense / cash-receipt reports.
 * Only confirmed amounts enter case stats. Employees cannot self-finalize.
 */
import { roundMoney } from './money'
import type { UserRole } from './types'

export type ExpenseReportStatus =
  | 'pending_review'
  | 'confirmed'
  | 'returned'
  | 'cancelled'

export type CashReceiptStatus =
  | 'pending_confirm'
  | 'confirmed'
  | 'returned'
  | 'cancelled'

export const EXPENSE_STATUS_LABELS: Record<ExpenseReportStatus, string> = {
  pending_review: '待審核',
  confirmed: '已確認',
  returned: '退回修改',
  cancelled: '已取消',
}

export const RECEIPT_STATUS_LABELS: Record<CashReceiptStatus, string> = {
  pending_confirm: '待確認',
  confirmed: '已確認',
  returned: '退回修改',
  cancelled: '已取消',
}

export function assertPositiveMoney(amount: number, label = '金額'): number {
  const a = roundMoney(Number(amount))
  if (!Number.isFinite(a) || a <= 0) throw new Error(`${label}必須大於 0`)
  return a
}

export function assertExpenseItem(item: string): string {
  const s = item.trim()
  if (!s) throw new Error('請填寫支出項目')
  return s
}

/** Employees cannot finalize their own expense / receipt. */
export function assertBossFinalize(input: {
  actorRole: UserRole
  actorId: string
  reporterId: string
}): void {
  if (input.actorRole !== 'boss') {
    throw new Error('僅老闆可最終審核／確認')
  }
  if (input.actorId === input.reporterId) {
    throw new Error('不可最終審核自己回報的支出／收款')
  }
}

export function assertCanReviewExpense(status: ExpenseReportStatus): void {
  if (status !== 'pending_review' && status !== 'returned') {
    throw new Error('僅待審核／退回件可再審核')
  }
}

export function assertCanConfirmReceipt(status: CashReceiptStatus): void {
  if (status !== 'pending_confirm' && status !== 'returned') {
    throw new Error('僅待確認／退回件可再確認')
  }
}

/**
 * Case balance (V1.0):
 * 有效合約 − 已確認支出 = 案件目前餘額
 * Receipts are tracked separately for cash visibility (not mixed into this formula).
 */
export function computeCaseFinance(input: {
  acceptedContractAmount: number
  confirmedExpenseTotal: number
  pendingExpenseTotal: number
  confirmedReceiptTotal: number
  pendingReceiptTotal: number
}): {
  acceptedContractAmount: number
  confirmedExpenseTotal: number
  pendingExpenseTotal: number
  confirmedReceiptTotal: number
  pendingReceiptTotal: number
  caseBalance: number
} {
  const accepted = roundMoney(Number(input.acceptedContractAmount) || 0)
  const confExp = roundMoney(Number(input.confirmedExpenseTotal) || 0)
  return {
    acceptedContractAmount: accepted,
    confirmedExpenseTotal: confExp,
    pendingExpenseTotal: roundMoney(Number(input.pendingExpenseTotal) || 0),
    confirmedReceiptTotal: roundMoney(Number(input.confirmedReceiptTotal) || 0),
    pendingReceiptTotal: roundMoney(Number(input.pendingReceiptTotal) || 0),
    caseBalance: roundMoney(accepted - confExp),
  }
}
