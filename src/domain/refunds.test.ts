import { describe, expect, it } from 'vitest'
import {
  assertCreditNoteFits,
  assertRefundFits,
  balanceReconciliation,
} from './refunds'

describe('FIN-005 折讓／退款', () => {
  it('折讓不可超過已請款；退款不可超過原收款', () => {
    expect(() =>
      assertCreditNoteFits({
        billed: 5000,
        alreadyCredited: 4000,
        crediting: 1500,
      }),
    ).toThrow(/不可超過已開立請款/)
    expect(() =>
      assertRefundFits({
        paymentAmount: 2000,
        alreadyRefundedOnPayment: 1500,
        refunding: 600,
      }),
    ).toThrow(/不可超過該筆原收款/)
  })

  it('餘額核對分開合約／請款／折讓／現金／退款', () => {
    const bal = balanceReconciliation({
      contract: 12000,
      billingDocuments: [{ status: 'issued', amountAfterTax: 10000 }],
      payments: [{ status: 'confirmed', amount: 8000 }],
      creditNotes: [{ status: 'issued', amount: 1000 }],
      refunds: [{ status: 'confirmed', amount: 500 }],
    })
    expect(bal.contract).toBe(12000)
    expect(bal.billed).toBe(10000)
    expect(bal.credited).toBe(1000)
    expect(bal.netReceivable).toBe(9000)
    expect(bal.cashIn).toBe(8000)
    expect(bal.cashOutRefunds).toBe(500)
    expect(bal.netCash).toBe(7500)
  })
})
