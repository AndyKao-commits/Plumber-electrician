/**
 * INV-002: immutable stock ledger, reservations, and location transfers.
 * Transfer ≠ usage; available = on-hand − active reserved; no negative stock.
 */
import { roundMoney } from './money'

export type StockMovementType =
  | 'inbound'
  | 'transfer'
  | 'reserve'
  | 'release'
  | 'usage'
  | 'adjust'
  | 'reversal'

export type StockLocationKind = 'warehouse' | 'site'

export type StockReservationStatus = 'active' | 'released' | 'consumed'

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  inbound: '入庫',
  transfer: '調撥',
  reserve: '預留',
  release: '釋放預留',
  usage: '耗用',
  adjust: '調整',
  reversal: '沖銷',
}

export function assertPositiveQty(qty: number, label = '數量'): number {
  const q = Number(qty)
  if (!Number.isFinite(q) || q <= 0) throw new Error(`${label}必須大於 0`)
  return roundMoney(q, 4)
}

/** Available qty = on-hand − active reservations. */
export function computeAvailableQty(input: {
  onHand: number
  reserved: number
}): number {
  return roundMoney(Number(input.onHand) - Number(input.reserved), 4)
}

export function sumActiveReserved(
  reservations: Array<{ qty: number; status: StockReservationStatus }>,
): number {
  return roundMoney(
    reservations
      .filter((r) => r.status === 'active')
      .reduce((s, r) => s + Number(r.qty), 0),
    4,
  )
}

export function assertNoNegativeOnHand(input: {
  onHand: number
  delta: number
}): number {
  const next = roundMoney(Number(input.onHand) + Number(input.delta), 4)
  if (next < -0.0001) throw new Error('禁止負庫存')
  return next < 0 ? 0 : next
}

export function assertAvailableForConsume(input: {
  onHand: number
  reserved: number
  qty: number
  label?: string
}): void {
  const qty = assertPositiveQty(input.qty, input.label ?? '數量')
  const available = computeAvailableQty({
    onHand: input.onHand,
    reserved: input.reserved,
  })
  if (available + 0.0001 < qty) {
    throw new Error(
      `可用量不足（可用 ${available}，需求 ${qty}）；預留占用不計可用`,
    )
  }
}

/** INV-02: warehouse↔site transfer is not actual usage and must not change cost pool. */
export function assertTransferDoesNotAffectCost(input: {
  beforeUnitCost: number
  afterUnitCost: number
  beforeOrgQty: number
  afterOrgQty: number
}): void {
  if (roundMoney(input.beforeUnitCost, 4) !== roundMoney(input.afterUnitCost, 4)) {
    throw new Error('調撥不可重算單位成本')
  }
  if (roundMoney(input.beforeOrgQty, 4) !== roundMoney(input.afterOrgQty, 4)) {
    throw new Error('調撥不可改變組織總庫存（調撥≠耗用）')
  }
}

export function isUsageMovement(type: StockMovementType): boolean {
  return type === 'usage'
}

export function assertLedgerImmutable(input: {
  action: 'update' | 'delete'
}): never {
  throw new Error(
    input.action === 'delete'
      ? '正式庫存流水帳不可刪除；請以沖銷（reversal）修正'
      : '正式庫存流水帳不可覆寫；請以沖銷（reversal）修正',
  )
}

export function assertReservationRelease(input: {
  status: StockReservationStatus
  releaseQty: number
  reservedQty: number
}): number {
  if (input.status !== 'active') throw new Error('僅有效預留可釋放')
  const qty = assertPositiveQty(input.releaseQty, '釋放數量')
  if (qty > Number(input.reservedQty) + 0.0001) {
    throw new Error('釋放數量不可超過預留量')
  }
  return qty
}
