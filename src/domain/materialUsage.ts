/**
 * REP-002 / REP-06 / INV-003 slice:
 * Formal material usage for repairs — shared inventory ledger, deduct once,
 * no negative stock. Quote may target repair without a project (FIN-03 XOR).
 */
import { roundMoney } from './money'

export function assertUsageQty(qty: number): number {
  const q = Number(qty)
  if (!Number.isFinite(q) || q <= 0) throw new Error('耗用數量必須大於 0')
  return q
}

export function assertNoNegativeStock(input: {
  availableQty: number
  usageQty: number
}): void {
  const next = roundMoney(input.availableQty - input.usageQty, 4)
  if (next < -0.0001) {
    throw new Error('庫存不足，禁止負庫存耗用')
  }
}

export function computeUsageCost(input: {
  qty: number
  unitCost: number
}): number {
  return roundMoney(assertUsageQty(input.qty) * Number(input.unitCost || 0))
}

/**
 * Idempotency: same client operation must not deduct twice.
 */
export function assertUsageNotAlreadyPosted(input: {
  clientOperationId: string
  existingOperationIds: string[]
}): void {
  const key = input.clientOperationId.trim()
  if (!key) throw new Error('耗用需提供冪等鍵（clientOperationId）')
  if (input.existingOperationIds.includes(key)) {
    throw new Error('此耗用已過帳，材料只扣一次（禁止重複耗用）')
  }
}

/** Repair quote does not require a project — XOR already enforced elsewhere. */
export function canQuoteRepairWithoutProject(input: {
  repairCaseId?: string | null
  projectId?: string | null
}): boolean {
  return Boolean(input.repairCaseId) && !input.projectId
}
