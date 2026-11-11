/**
 * INV-001: material master — SKU, unit conversion, unique serials, org isolation.
 */
import { roundMoney } from './money'

export type MaterialTrackingMode = 'quantity' | 'serial'

export type MaterialUnitDef = {
  id: string
  code: string
  label: string
  /** How many base units equal 1 of this unit. Base unit factor = 1. */
  factorToBase: number
  isBase: boolean
}

export function assertSku(sku: string): string {
  const s = sku.trim().toUpperCase()
  if (!s) throw new Error('材料 SKU 必填')
  if (s.length > 40) throw new Error('SKU 過長')
  return s
}

export function assertSerialNumber(serial: string): string {
  const s = serial.trim()
  if (!s) throw new Error('序號必填')
  if (s.length > 80) throw new Error('序號過長')
  return s
}

export function assertUnitFactor(factorToBase: number): number {
  const f = Number(factorToBase)
  if (!Number.isFinite(f) || f <= 0) throw new Error('單位換算係數必須大於 0')
  return roundMoney(f, 6)
}

/** Convert qty from one unit to another via base. */
export function convertMaterialQty(input: {
  qty: number
  fromFactorToBase: number
  toFactorToBase: number
}): number {
  const qty = Number(input.qty)
  if (!Number.isFinite(qty)) throw new Error('數量無效')
  const from = assertUnitFactor(input.fromFactorToBase)
  const to = assertUnitFactor(input.toFactorToBase)
  return roundMoney((qty * from) / to, 4)
}

export function toBaseQty(input: {
  qty: number
  factorToBase: number
}): number {
  return convertMaterialQty({
    qty: input.qty,
    fromFactorToBase: input.factorToBase,
    toFactorToBase: 1,
  })
}

export function assertSerialUniqueInOrg(input: {
  serial: string
  existingSerials: string[]
}): string {
  const serial = assertSerialNumber(input.serial)
  const key = serial.toLowerCase()
  if (input.existingSerials.some((s) => s.trim().toLowerCase() === key)) {
    throw new Error('序號組織內必須唯一')
  }
  return serial
}

export function assertSkuUniqueInOrg(input: {
  sku: string
  existingSkus: string[]
}): string {
  const sku = assertSku(input.sku)
  if (input.existingSkus.some((s) => s.trim().toUpperCase() === sku)) {
    throw new Error('SKU 組織內必須唯一')
  }
  return sku
}

export function assertSameOrganization(
  actorOrgId: string,
  resourceOrgId: string,
  label = '材料',
): void {
  if (actorOrgId !== resourceOrgId) {
    throw new Error(`${label}組織隔離：不可跨組織操作`)
  }
}

/** Serial-tracked materials use individual cost; quantity uses moving average pool. */
export function usesIndividualSerialCost(mode: MaterialTrackingMode): boolean {
  return mode === 'serial'
}
