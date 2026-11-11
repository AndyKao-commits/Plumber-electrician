import { describe, expect, it } from 'vitest'
import {
  assertAvailableForConsume,
  assertLedgerImmutable,
  assertNoNegativeOnHand,
  assertReservationRelease,
  assertTransferDoesNotAffectCost,
  computeAvailableQty,
  isUsageMovement,
  sumActiveReserved,
} from './stockLedger'

describe('INV-002 stock ledger', () => {
  it('available = onHand − reserved', () => {
    expect(computeAvailableQty({ onHand: 20, reserved: 5 })).toBe(15)
    expect(sumActiveReserved([
      { qty: 3, status: 'active' },
      { qty: 2, status: 'released' },
      { qty: 4, status: 'active' },
    ])).toBe(7)
  })

  it('blocks consume beyond available (reserved held)', () => {
    expect(() =>
      assertAvailableForConsume({ onHand: 10, reserved: 4, qty: 7 }),
    ).toThrow(/可用量不足/)
    expect(() =>
      assertAvailableForConsume({ onHand: 10, reserved: 4, qty: 6 }),
    ).not.toThrow()
  })

  it('transfer is not usage and does not change cost pool', () => {
    expect(isUsageMovement('transfer')).toBe(false)
    expect(isUsageMovement('usage')).toBe(true)
    expect(() =>
      assertTransferDoesNotAffectCost({
        beforeUnitCost: 45,
        afterUnitCost: 45,
        beforeOrgQty: 20,
        afterOrgQty: 20,
      }),
    ).not.toThrow()
    expect(() =>
      assertTransferDoesNotAffectCost({
        beforeUnitCost: 45,
        afterUnitCost: 50,
        beforeOrgQty: 20,
        afterOrgQty: 20,
      }),
    ).toThrow(/調撥不可重算/)
    expect(() =>
      assertTransferDoesNotAffectCost({
        beforeUnitCost: 45,
        afterUnitCost: 45,
        beforeOrgQty: 20,
        afterOrgQty: 18,
      }),
    ).toThrow(/調撥≠耗用/)
  })

  it('ledger is append-only', () => {
    expect(() => assertLedgerImmutable({ action: 'update' })).toThrow(/不可覆寫/)
    expect(() => assertLedgerImmutable({ action: 'delete' })).toThrow(/不可刪除/)
  })

  it('no negative on-hand; reservation release only when active', () => {
    expect(assertNoNegativeOnHand({ onHand: 5, delta: -3 })).toBe(2)
    expect(() => assertNoNegativeOnHand({ onHand: 2, delta: -3 })).toThrow(
      /禁止負庫存/,
    )
    expect(
      assertReservationRelease({
        status: 'active',
        releaseQty: 2,
        reservedQty: 5,
      }),
    ).toBe(2)
    expect(() =>
      assertReservationRelease({
        status: 'released',
        releaseQty: 1,
        reservedQty: 1,
      }),
    ).toThrow(/僅有效預留/)
  })
})
