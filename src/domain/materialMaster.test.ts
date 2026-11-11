import { describe, expect, it } from 'vitest'
import {
  assertSerialUniqueInOrg,
  assertSkuUniqueInOrg,
  assertSameOrganization,
  convertMaterialQty,
  toBaseQty,
  usesIndividualSerialCost,
} from './materialMaster'

describe('INV-001 material master', () => {
  it('converts units via base (箱→支)', () => {
    // 1 箱 = 20 支 (factor 20); 支 base factor 1
    expect(
      convertMaterialQty({ qty: 2, fromFactorToBase: 20, toFactorToBase: 1 }),
    ).toBe(40)
    expect(toBaseQty({ qty: 1.5, factorToBase: 20 })).toBe(30)
    expect(
      convertMaterialQty({ qty: 40, fromFactorToBase: 1, toFactorToBase: 20 }),
    ).toBe(2)
  })

  it('enforces unique SKU and serial within org', () => {
    expect(
      assertSkuUniqueInOrg({ sku: ' pvc-4 ', existingSkus: ['WIRE-20'] }),
    ).toBe('PVC-4')
    expect(() =>
      assertSkuUniqueInOrg({ sku: 'pvc-4', existingSkus: ['PVC-4'] }),
    ).toThrow(/SKU 組織內必須唯一/)
    expect(
      assertSerialUniqueInOrg({
        serial: 'SN-001',
        existingSerials: ['SN-002'],
      }),
    ).toBe('SN-001')
    expect(() =>
      assertSerialUniqueInOrg({
        serial: 'sn-001',
        existingSerials: ['SN-001'],
      }),
    ).toThrow(/序號組織內必須唯一/)
  })

  it('org isolation and serial cost mode', () => {
    expect(() =>
      assertSameOrganization('org-a', 'org-b'),
    ).toThrow(/組織隔離/)
    expect(usesIndividualSerialCost('serial')).toBe(true)
    expect(usesIndividualSerialCost('quantity')).toBe(false)
  })
})
