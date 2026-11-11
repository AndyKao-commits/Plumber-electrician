import { describe, expect, it } from 'vitest'
import {
  assertWithinCreditLimit,
  availableCredit,
  sumSupplierExposure,
} from './suppliers'

describe('SUP-001 supplier exposure', () => {
  it('does not double-count unpaid and commitment for same purchase', () => {
    const sums = sumSupplierExposure([
      {
        id: '1',
        finalPayable: 3000,
        status: 'approved',
        inboundAt: null,
      },
      {
        id: '2',
        finalPayable: 2000,
        status: 'purchased',
        inboundAt: '2026-11-11T00:00:00Z',
      },
      {
        id: '3',
        finalPayable: 1000,
        status: 'purchased',
        inboundAt: '2026-11-11T00:00:00Z',
        paidAt: '2026-11-11T01:00:00Z',
      },
    ])
    expect(sums.openCommitment).toBe(3000)
    expect(sums.unpaidPayable).toBe(2000)
    expect(sums.exposure).toBe(5000)
    expect(availableCredit({ creditLimit: 8000, exposure: 5000 })).toBe(3000)
  })

  it('blocks when next purchase exceeds credit', () => {
    expect(() =>
      assertWithinCreditLimit({
        creditLimit: 5000,
        exposure: 4000,
        nextAmount: 1500,
      }),
    ).toThrow(/超過供應商信用額度/)
    expect(() =>
      assertWithinCreditLimit({
        creditLimit: null,
        exposure: 99999,
        nextAmount: 1,
      }),
    ).not.toThrow()
  })
})
