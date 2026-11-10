import { describe, expect, it } from 'vitest'
import { effectiveContractAmountWithChangeOrders } from '@/domain/changeOrders'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb 追加減', () => {
  it('未接受追加不計合約；接受後加減正確', () => {
    const b = boss()
    const repair = localDb.getRepairCases()[0]
    const quote = localDb.createQuotation({
      createdBy: b.id,
      title: `追加減測試-${Date.now()}`,
      repairCaseId: repair.id,
      taxMode: 'zero',
      customerName: '合約客戶',
    })
    localDb.addQuotationItem({
      quotationId: quote.id,
      kind: 'labor',
      description: '工資',
      qty: 1,
      unitPrice: 10000,
    })
    localDb.exportQuotationVersion({ id: b.id, role: b.role }, quote.id, 'pdf')
    localDb.setQuoteWorkflowStatus(
      { id: b.id, role: b.role },
      quote.id,
      'accepted',
    )

    expect(() =>
      localDb.createChangeOrder(
        { id: b.id, role: b.role },
        {
          quotationId: quote.id,
          kind: 'addition',
          title: '早了',
        },
      ),
    ).not.toThrow()

    // recreate on a non-accepted should fail — use exported-only quote
    const q2 = localDb.createQuotation({
      createdBy: b.id,
      title: `未接受不可追加-${Date.now()}`,
      repairCaseId: repair.id,
      taxMode: 'zero',
    })
    expect(() =>
      localDb.createChangeOrder(
        { id: b.id, role: b.role },
        { quotationId: q2.id, kind: 'addition', title: '不可' },
      ),
    ).toThrow(/客戶已接受/)

    const coAdd = localDb.listChangeOrders(quote.id)[0]
    localDb.addChangeOrderItem({
      changeOrderId: coAdd.id,
      kind: 'other',
      description: '增項',
      qty: 1,
      unitPrice: 2000,
    })
    const coRed = localDb.createChangeOrder(
      { id: b.id, role: b.role },
      { quotationId: quote.id, kind: 'reduction', title: '減項' },
    )
    localDb.addChangeOrderItem({
      changeOrderId: coRed.id,
      kind: 'other',
      description: '減價',
      qty: 1,
      unitPrice: 500,
    })

    let total = effectiveContractAmountWithChangeOrders({
      quotes: [localDb.getQuotation(quote.id)!],
      changeOrders: localDb.listChangeOrders(quote.id),
    })
    expect(total).toBe(10000)

    localDb.setChangeOrderStatus(
      { id: b.id, role: b.role },
      coAdd.id,
      'accepted',
    )
    localDb.setChangeOrderStatus(
      { id: b.id, role: b.role },
      coRed.id,
      'accepted',
    )
    total = effectiveContractAmountWithChangeOrders({
      quotes: [localDb.getQuotation(quote.id)!],
      changeOrders: localDb.listChangeOrders(quote.id),
    })
    expect(total).toBe(11500)
  })

  it('Member 可建草稿；不可標記接受', () => {
    const b = boss()
    const m = localDb.getUsers().find((u) => u.role === 'employee')
    if (!m) throw new Error('no member')
    const repair = localDb.getRepairCases()[0]
    const quote = localDb.createQuotation({
      createdBy: b.id,
      title: `Member追加-${Date.now()}`,
      repairCaseId: repair.id,
      taxMode: 'exclusive',
    })
    localDb.addQuotationItem({
      quotationId: quote.id,
      kind: 'material',
      description: '料',
      qty: 1,
      unitPrice: 100,
    })
    localDb.exportQuotationVersion({ id: b.id, role: b.role }, quote.id)
    localDb.setQuoteWorkflowStatus(
      { id: b.id, role: b.role },
      quote.id,
      'accepted',
    )
    const co = localDb.createChangeOrder(
      { id: m.id, role: m.role },
      { quotationId: quote.id, kind: 'addition', title: 'Member 草稿' },
    )
    localDb.addChangeOrderItem({
      changeOrderId: co.id,
      kind: 'labor',
      description: '工',
      qty: 1,
      unitPrice: 50,
    })
    expect(() =>
      localDb.setChangeOrderStatus(
        { id: m.id, role: m.role },
        co.id,
        'accepted',
      ),
    ).toThrow(/無權/)
  })
})
