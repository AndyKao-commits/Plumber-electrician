import { describe, expect, it } from 'vitest'
import {
  assertAdvanceApplicationFits,
  assertAllocationFits,
  billingDocumentOpenAmount,
  cashAndSettlementSummary,
  canRecordPaymentForQuote,
} from './payments'

describe('FIN-004 收款／預收', () => {
  it('僅已接受報價可登錄收款', () => {
    expect(
      canRecordPaymentForQuote({
        workflowStatus: 'accepted',
        deletedAt: null,
      }).ok,
    ).toBe(true)
    expect(
      canRecordPaymentForQuote({
        workflowStatus: 'exported',
        deletedAt: null,
      }).ok,
    ).toBe(false)
  })

  it('收款分配不可超收款或超請款未清', () => {
    expect(() =>
      assertAllocationFits({
        paymentAmount: 1000,
        alreadyAllocatedOnPayment: 800,
        allocating: 300,
        billingOpenAmount: 5000,
      }),
    ).toThrow(/不可超過已確認收款/)
    expect(() =>
      assertAllocationFits({
        paymentAmount: 1000,
        alreadyAllocatedOnPayment: 0,
        allocating: 500,
        billingOpenAmount: 400,
      }),
    ).toThrow(/尚未清償/)
  })

  it('預收抵充不新增現金；不可超剩餘／請款', () => {
    expect(() =>
      assertAdvanceApplicationFits({
        advanceRemaining: 200,
        applying: 300,
        billingOpenAmount: 1000,
      }),
    ).toThrow(/預收剩餘/)
    const open = billingDocumentOpenAmount({
      document: { status: 'issued', amountAfterTax: 5000 },
      allocations: [{ amount: 1000 }],
      advanceApplications: [{ amount: 500 }],
    })
    expect(open).toBe(3500)

    const summary = cashAndSettlementSummary({
      billingDocuments: [{ status: 'issued', amountAfterTax: 5000 }],
      payments: [{ status: 'confirmed', amount: 1000 }],
      allocations: [{ amount: 1000 }],
      advances: [
        { status: 'open', remainingAmount: 500, amount: 1000 },
      ],
      advanceApplications: [{ amount: 500 }],
    })
    expect(summary.cashReceived).toBe(1000)
    expect(summary.settledOnBilling).toBe(1500)
    expect(summary.openAdvances).toBe(500)
    expect(summary.unallocatedCash).toBe(0)
  })
})
