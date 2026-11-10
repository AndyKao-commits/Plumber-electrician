import { describe, expect, it } from 'vitest'
import {
  assertCanRecordOperatingCost,
  assertOperatingCostAmount,
  canViewCostAndMargin,
  computeCaseFinanceSummary,
  sumConfirmedOperatingCosts,
} from './financeSummary'

describe('FIN-006 財務摘要與成本權限', () => {
  it('帳款／現金／成本分開；不認列收入', () => {
    const summary = computeCaseFinanceSummary({
      quotes: [{ workflowStatus: 'accepted', amountAfterTax: 10000 }],
      changeOrders: [],
      billingDocuments: [{ status: 'issued', amountAfterTax: 8000 }],
      payments: [{ status: 'confirmed', amount: 5000 }],
      creditNotes: [{ status: 'issued', amount: 500 }],
      refunds: [{ status: 'confirmed', amount: 200 }],
      operatingCosts: [
        { status: 'confirmed', amount: 3000, warrantyFree: false },
        { status: 'void', amount: 9999, warrantyFree: false },
      ],
      viewer: { role: 'boss' },
    })
    expect(summary.contract).toBe(10000)
    expect(summary.netReceivable).toBe(7500)
    expect(summary.netCash).toBe(4800)
    expect(summary.confirmedCost).toBe(3000)
    expect(summary.indicativeMarginVsContract).toBe(7000)
    expect(summary.recognizedRevenue).toBeNull()
    expect(summary.revenueRecognition).toBe('not_applicable')
    expect(summary.costVisible).toBe(true)
  })

  it('Admin／Member 預設看不到成本與毛利', () => {
    expect(canViewCostAndMargin('admin')).toBe(false)
    expect(canViewCostAndMargin('member')).toBe(false)
    expect(canViewCostAndMargin('boss')).toBe(true)
    expect(canViewCostAndMargin('admin', true)).toBe(true)

    const masked = computeCaseFinanceSummary({
      quotes: [{ workflowStatus: 'accepted', amountAfterTax: 10000 }],
      changeOrders: [],
      billingDocuments: [{ status: 'issued', amountAfterTax: 10000 }],
      payments: [{ status: 'confirmed', amount: 10000 }],
      creditNotes: [],
      refunds: [],
      operatingCosts: [{ status: 'confirmed', amount: 4000, warrantyFree: false }],
      viewer: { role: 'admin' },
    })
    expect(masked.costVisible).toBe(false)
    expect(masked.confirmedCost).toBeNull()
    expect(masked.indicativeMarginVsContract).toBeNull()
    expect(masked.netCash).toBe(10000)
    expect(masked.recognizedRevenue).toBeNull()
  })

  it('免費保固：客戶收費可為 0，內部成本保留', () => {
    const summary = computeCaseFinanceSummary({
      quotes: [{ workflowStatus: 'accepted', amountAfterTax: 0 }],
      changeOrders: [],
      billingDocuments: [],
      payments: [],
      creditNotes: [],
      refunds: [],
      operatingCosts: [
        { status: 'confirmed', amount: 1500, warrantyFree: true },
      ],
      viewer: { role: 'owner' },
    })
    expect(summary.contract).toBe(0)
    expect(summary.confirmedCost).toBe(1500)
    expect(summary.indicativeMarginVsContract).toBe(-1500)
    expect(summary.warrantyFreeCase).toBe(true)
    expect(summary.recognizedRevenue).toBeNull()
  })

  it('僅 Owner／finance.write 可登錄成本；金額規則', () => {
    expect(() => assertCanRecordOperatingCost('admin')).toThrow(/無權登錄營運成本/)
    expect(() => assertCanRecordOperatingCost('member')).toThrow(/無權登錄營運成本/)
    expect(() => assertCanRecordOperatingCost('boss')).not.toThrow()
    expect(() => assertOperatingCostAmount(0)).toThrow(/必須大於 0/)
    expect(() => assertOperatingCostAmount(-1)).toThrow(/不可為負/)
    expect(sumConfirmedOperatingCosts([
      { status: 'confirmed', amount: 10 },
      { status: 'void', amount: 50 },
    ])).toBe(10)
  })
})
