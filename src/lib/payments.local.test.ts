import { describe, expect, it } from 'vitest'
import { cashAndSettlementSummary } from '@/domain/payments'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

function acceptedQuote(title: string) {
  const b = boss()
  const repair = localDb.getRepairCases()[0]
  const quote = localDb.createQuotation({
    createdBy: b.id,
    title,
    repairCaseId: repair.id,
    taxMode: 'zero',
  })
  localDb.addQuotationItem({
    quotationId: quote.id,
    kind: 'labor',
    description: '工資',
    qty: 1,
    unitPrice: 10000,
  })
  localDb.exportQuotationVersion({ id: b.id, role: b.role }, quote.id)
  localDb.setQuoteWorkflowStatus(
    { id: b.id, role: b.role },
    quote.id,
    'accepted',
  )
  return { b, quote }
}

describe('localDb 收款／預收 FIN-004', () => {
  it('分配不可超收款；預收抵充不新增現金', () => {
    const { b, quote } = acceptedQuote(`收款測試-${Date.now()}`)
    const ms = localDb.createBillingMilestone(
      { id: b.id, role: b.role },
      {
        quotationId: quote.id,
        code: 'DEP',
        title: '訂金',
        plannedAmount: 4000,
      },
    )
    const doc = localDb.createBillingDocument(
      { id: b.id, role: b.role },
      { quotationId: quote.id, milestoneId: ms.id },
    )
    localDb.issueBillingDocument({ id: b.id, role: b.role }, doc.id)

    const pay = localDb.createCustomerPayment(
      { id: b.id, role: b.role },
      { quotationId: quote.id, amount: 3000, method: 'transfer' },
    )
    expect(() =>
      localDb.allocatePayment(
        { id: b.id, role: b.role },
        {
          paymentId: pay.id,
          billingDocumentId: doc.id,
          amount: 3500,
        },
      ),
    ).toThrow(/不可超過已確認收款/)

    localDb.allocatePayment(
      { id: b.id, role: b.role },
      { paymentId: pay.id, billingDocumentId: doc.id, amount: 2000 },
    )

    const adv = localDb.createCustomerAdvance(
      { id: b.id, role: b.role },
      { quotationId: quote.id, amount: 1500 },
    )
    localDb.applyCustomerAdvance(
      { id: b.id, role: b.role },
      { advanceId: adv.id, billingDocumentId: doc.id, amount: 1000 },
    )

    const summary = cashAndSettlementSummary({
      billingDocuments: localDb.listBillingDocuments(quote.id),
      payments: localDb.listCustomerPayments(quote.id),
      allocations: localDb.listPaymentAllocations({ quotationId: quote.id }),
      advances: localDb.listCustomerAdvances(quote.id),
      advanceApplications: localDb.listAdvanceApplications({
        quotationId: quote.id,
      }),
    })
    expect(summary.cashReceived).toBe(3000)
    expect(summary.settledOnBilling).toBe(3000) // 2000 cash alloc + 1000 advance
    expect(summary.openAdvances).toBe(500)
    expect(summary.unallocatedCash).toBe(1000)
  })

  it('Member 不可收款', () => {
    const { quote } = acceptedQuote(`Member收款-${Date.now()}`)
    const m = localDb.getUsers().find((u) => u.role === 'employee')
    if (!m) throw new Error('no member')
    expect(() =>
      localDb.createCustomerPayment(
        { id: m.id, role: m.role },
        { quotationId: quote.id, amount: 100, method: 'cash' },
      ),
    ).toThrow(/無權管理收款/)
  })
})
