import { describe, expect, it } from 'vitest'
import { computeCaseFinanceSummary } from '@/domain/financeSummary'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

function employee() {
  const u = localDb.getUsers().find((x) => x.role === 'employee')
  if (!u) throw new Error('no employee')
  return u
}

describe('localDb FIN-006 財務摘要', () => {
  it('登錄成本需老闆；Member 摘要隱藏成本；免費保固保留成本', () => {
    const b = boss()
    const e = employee()
    const repair = localDb.getRepairCases()[0]
    const quote = localDb.createQuotation({
      createdBy: b.id,
      title: `摘要測試-${Date.now()}`,
      repairCaseId: repair.id,
      taxMode: 'zero',
    })
    localDb.addQuotationItem({
      quotationId: quote.id,
      kind: 'labor',
      description: '保固',
      qty: 1,
      unitPrice: 0,
    })
    localDb.exportQuotationVersion({ id: b.id, role: b.role }, quote.id)
    localDb.setQuoteWorkflowStatus(
      { id: b.id, role: b.role },
      quote.id,
      'accepted',
    )

    expect(() =>
      localDb.createCaseOperatingCost(
        { id: e.id, role: e.role },
        {
          quotationId: quote.id,
          kind: 'material',
          description: '電線',
          amount: 800,
          warrantyFree: true,
        },
      ),
    ).toThrow(/無權登錄營運成本/)

    localDb.createCaseOperatingCost(
      { id: b.id, role: b.role },
      {
        quotationId: quote.id,
        kind: 'material',
        description: '電線',
        amount: 800,
        warrantyFree: true,
      },
    )

    const costs = localDb.listCaseOperatingCosts(quote.id)
    expect(costs).toHaveLength(1)

    const ownerView = computeCaseFinanceSummary({
      quotes: [localDb.getQuotation(quote.id)!],
      changeOrders: [],
      billingDocuments: [],
      payments: [],
      creditNotes: [],
      refunds: [],
      operatingCosts: costs,
      viewer: { role: b.role },
    })
    expect(ownerView.contract).toBe(0)
    expect(ownerView.confirmedCost).toBe(800)
    expect(ownerView.warrantyFreeCase).toBe(true)
    expect(ownerView.recognizedRevenue).toBeNull()

    const memberView = computeCaseFinanceSummary({
      quotes: [localDb.getQuotation(quote.id)!],
      changeOrders: [],
      billingDocuments: [],
      payments: [],
      creditNotes: [],
      refunds: [],
      operatingCosts: costs,
      viewer: { role: e.role },
    })
    expect(memberView.confirmedCost).toBeNull()
    expect(memberView.costVisible).toBe(false)
  })
})
