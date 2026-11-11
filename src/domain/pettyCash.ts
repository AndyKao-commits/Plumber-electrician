/**
 * PET-001 / REV-05: petty cash top-up — request, Owner approve, disburse
 * are separate events. Approve ≠ disbursed.
 */
import { roundMoney } from './money'
import type { UserRole } from './types'

export type PettyCashRequestStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'disbursed'

export function assertTopUpAmount(amount: number): number {
  const a = roundMoney(Number(amount))
  if (!Number.isFinite(a) || a <= 0) throw new Error('補充金額必須大於 0')
  return a
}

export function canRequestPettyCashTopUp(role: UserRole): boolean {
  return role === 'boss' || role === 'employee'
}

export function canApprovePettyCashTopUp(role: UserRole): boolean {
  // Owner / boss only — Admin ops without finance does not approve petty cash.
  return role === 'boss'
}

export function canDisbursePettyCash(role: UserRole): boolean {
  return role === 'boss'
}

export function assertCanRequest(role: UserRole): void {
  if (!canRequestPettyCashTopUp(role)) {
    throw new Error('無權申請零用金補充')
  }
}

export function assertCanApprove(role: UserRole): void {
  if (!canApprovePettyCashTopUp(role)) {
    throw new Error('僅 Owner 可核准零用金補充')
  }
}

export function assertCanDisburse(role: UserRole): void {
  if (!canDisbursePettyCash(role)) {
    throw new Error('僅 Owner 可執行零用金撥款')
  }
}

export function assertRequestApprovable(status: PettyCashRequestStatus): void {
  if (status !== 'pending_approval') {
    throw new Error('僅待核准申請可核准／駁回')
  }
}

export function assertRequestDisbursable(status: PettyCashRequestStatus): void {
  if (status === 'disbursed') {
    throw new Error('此申請已撥款，不可重複撥款')
  }
  if (status !== 'approved') {
    throw new Error('核准不等於撥款：僅已核准申請可撥款')
  }
}

export function assertApproveDoesNotCreditBalance(input: {
  balanceBefore: number
  balanceAfterApprove: number
}): void {
  if (
    roundMoney(input.balanceBefore) !== roundMoney(input.balanceAfterApprove)
  ) {
    throw new Error('核准不可直接入帳（核准≠撥款）')
  }
}

export function applyDisbursementCredit(input: {
  balance: number
  amount: number
}): number {
  return roundMoney(input.balance + assertTopUpAmount(input.amount))
}

export const PETTY_CASH_STATUS_LABELS: Record<PettyCashRequestStatus, string> =
  {
    pending_approval: '待核准',
    approved: '已核准（未撥款）',
    rejected: '已駁回',
    disbursed: '已撥款',
  }
