import { describe, expect, it } from 'vitest'
import {
  assertNoNegativeStock,
  assertUsageNotAlreadyPosted,
  assertUsageQty,
  canQuoteRepairWithoutProject,
  computeUsageCost,
} from './materialUsage'

describe('REP-002 維修材料耗用', () => {
  it('禁止負庫存；成本＝數量×單位成本', () => {
    expect(assertUsageQty(2)).toBe(2)
    expect(() => assertUsageQty(0)).toThrow(/大於 0/)
    expect(() =>
      assertNoNegativeStock({ availableQty: 1, usageQty: 2 }),
    ).toThrow(/負庫存/)
    expect(computeUsageCost({ qty: 2, unitCost: 12.5 })).toBe(25)
  })

  it('同冪等鍵只扣一次；無工程亦可報價', () => {
    expect(() =>
      assertUsageNotAlreadyPosted({
        clientOperationId: 'op-1',
        existingOperationIds: ['op-1'],
      }),
    ).toThrow(/只扣一次/)
    expect(
      canQuoteRepairWithoutProject({
        repairCaseId: 'r1',
        projectId: null,
      }),
    ).toBe(true)
    expect(
      canQuoteRepairWithoutProject({
        repairCaseId: null,
        projectId: 'p1',
      }),
    ).toBe(false)
  })
})
