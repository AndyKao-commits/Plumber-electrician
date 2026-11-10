import { describe, expect, it } from 'vitest'
import {
  assertIssueDoesNotExceedContract,
  billingRemainingAgainstContract,
  canCreateBillingForQuote,
  sumIssuedBillingAmount,
} from './billing'

describe('FIN-003 請款節點與正式請款', () => {
  it('僅已接受報價可建立請款', () => {
    expect(
      canCreateBillingForQuote({
        workflowStatus: 'accepted',
        deletedAt: null,
      }).ok,
    ).toBe(true)
    expect(
      canCreateBillingForQuote({
        workflowStatus: 'exported',
        deletedAt: null,
      }).ok,
    ).toBe(false)
  })

  it('請款合計與合約餘額分開計算（≠ 收款）', () => {
    const rem = billingRemainingAgainstContract({
      quotes: [{ workflowStatus: 'accepted', amountAfterTax: 10000 }],
      changeOrders: [
        { status: 'accepted', kind: 'addition', amountAfterTax: 2000 },
      ],
      billingDocuments: [
        { status: 'draft', amountAfterTax: 9999 },
        { status: 'issued', amountAfterTax: 3000 },
        { status: 'void', amountAfterTax: 1000 },
      ],
    })
    expect(rem.contract).toBe(12000)
    expect(rem.billed).toBe(3000)
    expect(rem.remaining).toBe(9000)
    expect(
      sumIssuedBillingAmount([
        { status: 'issued', amountAfterTax: 3000 },
        { status: 'draft', amountAfterTax: 100 },
      ]),
    ).toBe(3000)
  })

  it('開立請款不可超過有效合約', () => {
    expect(() =>
      assertIssueDoesNotExceedContract({
        contract: 10000,
        alreadyIssued: 8000,
        issuingAmount: 3000,
      }),
    ).toThrow(/不可超過有效合約/)
    expect(() =>
      assertIssueDoesNotExceedContract({
        contract: 10000,
        alreadyIssued: 7000,
        issuingAmount: 3000,
      }),
    ).not.toThrow()
  })
})
