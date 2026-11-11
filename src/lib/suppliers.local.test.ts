import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

describe('localDb SUP-001 suppliers', () => {
  it('separates open commitment vs unpaid; credit blocks over-limit', () => {
    const supplier = localDb.listSuppliers()[0]
    const exposure = localDb.getSupplierExposure(supplier.id)
    expect(exposure.openCommitment).toBeGreaterThan(0)
    expect(exposure.unpaidPayable).toBe(0)
    expect(exposure.exposure).toBe(exposure.openCommitment + exposure.unpaidPayable)

    expect(() =>
      localDb.createPurchase({
        userId: 'user-boss',
        title: '超額測試',
        mode: 'normal',
        supplierId: supplier.id,
        goodsAmount: 999999,
      }),
    ).toThrow(/超過供應商信用額度/)
  })
})
