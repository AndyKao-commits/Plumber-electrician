import { roundMoney } from './money'

export type CostPoolKey = {
  organizationId: string
  materialId: string
}

/**
 * POL-003 / REV-06: moving weighted average at org + material pool.
 * Warehouse transfers do not recalculate. Zero stock re-inbound uses new batch cost.
 */
export function applyInboundMovingAverage(input: {
  oldQty: number
  oldUnitCost: number
  inboundQty: number
  inboundUnitCost: number
}): { qty: number; unitCost: number } {
  const inboundQty = input.inboundQty
  const inboundUnitCost = roundMoney(input.inboundUnitCost, 4)

  if (inboundQty <= 0) {
    throw new Error('入庫數量必須大於 0')
  }

  if (input.oldQty <= 0) {
    return { qty: inboundQty, unitCost: inboundUnitCost }
  }

  const totalQty = input.oldQty + inboundQty
  const unitCost = roundMoney(
    (input.oldQty * input.oldUnitCost + inboundQty * inboundUnitCost) / totalQty,
    4,
  )
  return { qty: totalQty, unitCost }
}

export function applyReturnAgainstInbound(input: {
  poolQty: number
  poolUnitCost: number
  returnQty: number
  originalInboundUnitCost: number
}): { qty: number; unitCost: number; costAdjustment: number } {
  if (input.returnQty <= 0) {
    throw new Error('退貨數量必須大於 0')
  }
  if (input.returnQty > input.poolQty) {
    throw new Error('退貨數量不可超過庫存')
  }

  const remainingQty = input.poolQty - input.returnQty
  // Difference vs pool average goes to cost adjustment event (not silent rewrite).
  const costAdjustment = roundMoney(
    (input.poolUnitCost - input.originalInboundUnitCost) * input.returnQty,
    2,
  )

  if (remainingQty === 0) {
    return { qty: 0, unitCost: 0, costAdjustment }
  }

  return {
    qty: remainingQty,
    unitCost: input.poolUnitCost,
    costAdjustment,
  }
}
