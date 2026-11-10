import { describe, expect, it } from 'vitest'
import { balanceReconciliation } from '@/domain/refunds'
import { effectiveContractAmountWithChangeOrders } from '@/domain/changeOrders'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb 折讓／退款 FIN-005', () => {
  it('退款保留原收款；不可超退；折讓不重複扣現金', () => {
    const b = boss()
    const repair = localDb.getRepairCases()[0]
    const quote = localDb.createQuotation({
      createdBy: b.id,
      title: `退款測試-${Date.now()}`,
      repairCaseId: repair.id,
      taxMode: 'zero',
    })
    localDb.addQuotationItem({
      quotationId: quote.id,
      kind: 'labor',
      description: '工',
      qty: 1,
      unitPrice: 10000,
    })
    localDb.exportQuotationVersion({ id: b.id, role: b.role }, quote.id)
    localDb.setQuoteWorkflowStatus(
      { id: b.id, role: b.role },
      quote.id,
      'accepted',
    )
    const ms = localDb.createBillingMilestone(
      { id: b.id, role: b.role },
      {
        quotationId: quote.id,
        code: 'FULL',
        title: '一次請款',
        plannedAmount: 10000,
      },
    )
    const doc = localDb.createBillingDocument(
      { id: b.id, role: b.role },
      { quotationId: quote.id, milestoneId: ms.id },
    )
    localDb.issueBillingDocument({ id: b.id, role: b.role }, doc.id)
    const pay = localDb.createCustomerPayment(
      { id: b.id, role: b.role },
      { quotationId: quote.id, amount: 6000, method: 'transfer' },
    )

    localDb.createCustomerCreditNote(
      { id: b.id, role: b.role },
      { quotationId: quote.id, amount: 1000, reason: '議價' },
    )
    expect(() =>
      localDb.createCustomerCreditNote(
        { id: b.id, role: b.role },
        { quotationId: quote.id, amount: 9500, reason: '超折' },
      ),
    ).toThrow(/不可超過已開立請款/)

    localDb.createCustomerRefund(
      { id: b.id, role: b.role },
      {
        quotationId: quote.id,
        paymentId: pay.id,
        amount: 2000,
        method: 'transfer',
        reason: '部分退',
      },
    )
    expect(localDb.listCustomerPayments(quote.id).find((p) => p.id === pay.id)?.amount).toBe(
      6000,
    )
    expect(() =>
      localDb.createCustomerRefund(
        { id: b.id, role: b.role },
        {
          quotationId: quote.id,
          paymentId: pay.id,
          amount: 5000,
          method: 'cash',
          reason: '超退',
        },
      ),
    ).toThrow(/不可超過該筆原收款/)

    const bal = balanceReconciliation({
      contract: effectiveContractAmountWithChangeOrders({
        quotes: [localDb.getQuotation(quote.id)!],
        changeOrders: localDb.listChangeOrders(quote.id),
      }),
      billingDocuments: localDb.listBillingDocuments(quote.id),
      payments: localDb.listCustomerPayments(quote.id),
      creditNotes: localDb.listCustomerCreditNotes(quote.id),
      refunds: localDb.listCustomerRefunds(quote.id),
    })
    expect(bal.netReceivable).toBe(9000)
    expect(bal.netCash).toBe(4000)
  })
})
