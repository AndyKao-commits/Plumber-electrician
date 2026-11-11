/**
 * SUP-001: supplier AP, open commitments, credit limit.
 * Unpaid AP and open PO commitments must not double-count the same purchase.
 */
import { roundMoney } from './money'

export type SupplierPurchaseSlice = {
  id: string
  finalPayable: number
  status: string
  inboundAt?: string | null
  paidAt?: string | null
}

export function isOpenCommitment(p: SupplierPurchaseSlice): boolean {
  if (p.paidAt) return false
  if (p.inboundAt) return false
  return p.status === 'approved' || p.status === 'purchased'
}

export function isUnpaidPayable(p: SupplierPurchaseSlice): boolean {
  if (p.paidAt) return false
  // Inbound (or explicit AP) becomes payable; still unpaid.
  return Boolean(p.inboundAt) && (p.status === 'approved' || p.status === 'purchased')
}

export function sumSupplierExposure(purchases: SupplierPurchaseSlice[]): {
  unpaidPayable: number
  openCommitment: number
  /** Non-overlapping total for credit check. */
  exposure: number
} {
  let unpaidPayable = 0
  let openCommitment = 0
  for (const p of purchases) {
    const amt = roundMoney(Number(p.finalPayable) || 0)
    if (isUnpaidPayable(p)) unpaidPayable = roundMoney(unpaidPayable + amt)
    else if (isOpenCommitment(p)) openCommitment = roundMoney(openCommitment + amt)
  }
  return {
    unpaidPayable,
    openCommitment,
    exposure: roundMoney(unpaidPayable + openCommitment),
  }
}

export function assertWithinCreditLimit(input: {
  creditLimit: number | null | undefined
  exposure: number
  nextAmount?: number
}): void {
  if (input.creditLimit == null || Number(input.creditLimit) <= 0) {
    // No limit configured — do not invent one.
    return
  }
  const next = roundMoney(
    Number(input.exposure) + Number(input.nextAmount || 0),
  )
  if (next > roundMoney(Number(input.creditLimit)) + 0.0001) {
    throw new Error(
      `超過供應商信用額度（曝險 ${next}／額度 ${input.creditLimit}）`,
    )
  }
}

export function assertSupplierName(name: string): string {
  const n = name.trim()
  if (!n) throw new Error('供應商名稱必填')
  return n
}

export function availableCredit(input: {
  creditLimit: number | null | undefined
  exposure: number
}): number | null {
  if (input.creditLimit == null || Number(input.creditLimit) <= 0) return null
  return roundMoney(Number(input.creditLimit) - Number(input.exposure))
}
