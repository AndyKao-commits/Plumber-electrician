import { describe, expect, it } from 'vitest'
import { billingRemainingAgainstContract } from '@/domain/billing'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb 請款 FIN-003', () => {
  it('同一節點不可重複正式請款；合計不可超合約', () => {
    const b = boss()
    const repair = localDb.getRepairCases()[0]
    const quote = localDb.createQuotation({
      createdBy: b.id,
      title: `請款測試-${Date.now()}`,
      repairCaseId: repair.id,
      taxMode: 'zero',
      customerName: '請款客戶',
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

    const m1 = localDb.createBillingMilestone(
      { id: b.id, role: b.role },
      {
        quotationId: quote.id,
        code: 'DEP',
        title: '訂金',
        plannedAmount: 3000,
      },
    )
    const m2 = localDb.createBillingMilestone(
      { id: b.id, role: b.role },
      {
        quotationId: quote.id,
        code: 'FINAL',
        title: '尾款',
        plannedAmount: 8000,
      },
    )

    const d1 = localDb.createBillingDocument(
      { id: b.id, role: b.role },
      { quotationId: quote.id, milestoneId: m1.id },
    )
    localDb.issueBillingDocument({ id: b.id, role: b.role }, d1.id)

    expect(() =>
      localDb.createBillingDocument(
        { id: b.id, role: b.role },
        { quotationId: quote.id, milestoneId: m1.id },
      ),
    ).toThrow(/不得重複開立/)

    const d2 = localDb.createBillingDocument(
      { id: b.id, role: b.role },
      { quotationId: quote.id, milestoneId: m2.id },
    )
    expect(() =>
      localDb.issueBillingDocument({ id: b.id, role: b.role }, d2.id),
    ).toThrow(/不可超過有效合約/)

    const rem = billingRemainingAgainstContract({
      quotes: [localDb.getQuotation(quote.id)!],
      changeOrders: localDb.listChangeOrders(quote.id),
      billingDocuments: localDb.listBillingDocuments(quote.id),
    })
    expect(rem.contract).toBe(10000)
    expect(rem.billed).toBe(3000)
    expect(rem.remaining).toBe(7000)
  })

  it('Member 不可管理請款', () => {
    const b = boss()
    const m = localDb.getUsers().find((u) => u.role === 'employee')
    if (!m) throw new Error('no member')
    const repair = localDb.getRepairCases()[0]
    const quote = localDb.createQuotation({
      createdBy: b.id,
      title: `Member請款-${Date.now()}`,
      repairCaseId: repair.id,
      taxMode: 'zero',
    })
    localDb.addQuotationItem({
      quotationId: quote.id,
      kind: 'other',
      description: '項',
      qty: 1,
      unitPrice: 1000,
    })
    localDb.exportQuotationVersion({ id: b.id, role: b.role }, quote.id)
    localDb.setQuoteWorkflowStatus(
      { id: b.id, role: b.role },
      quote.id,
      'accepted',
    )
    expect(() =>
      localDb.createBillingMilestone(
        { id: m.id, role: m.role },
        {
          quotationId: quote.id,
          code: 'X',
          title: 'X',
          plannedAmount: 100,
        },
      ),
    ).toThrow(/無權管理請款/)
  })
})
