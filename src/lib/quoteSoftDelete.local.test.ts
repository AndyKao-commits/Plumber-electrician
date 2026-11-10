import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

const QUOTE_KEY = 'eg.quotations.v2'
const VERSION_KEY = 'eg.quotationVersions.v1'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

function member() {
  const u = localDb.getUsers().find((x) => x.role === 'employee')
  if (!u) throw new Error('no member')
  return u
}

function makeQuote(title: string) {
  const b = boss()
  const repair = localDb.getRepairCases()[0]
  return localDb.createQuotation({
    createdBy: b.id,
    title,
    repairCaseId: repair.id,
    taxMode: 'exclusive',
    customerName: '測試客戶',
  })
}

describe('localDb 報價軟刪除', () => {
  it('軟刪除案件後列表隱藏，版本一併隱藏且稽核保留', () => {
    const b = boss()
    const quote = makeQuote(`刪除案件-${Date.now()}`)
    localDb.addQuotationItem({
      quotationId: quote.id,
      kind: 'labor',
      description: '工資',
      qty: 1,
      unit: '式',
      unitPrice: 1000,
    })
    const { version } = localDb.exportQuotationVersion(
      { id: b.id, role: b.role },
      quote.id,
      'pdf',
    )
    expect(localDb.getQuotationVersions(quote.id)).toHaveLength(1)

    localDb.softDeleteQuotation(
      { id: b.id, role: b.role },
      quote.id,
      '測試刪除',
    )

    expect(localDb.getQuotations().some((q) => q.id === quote.id)).toBe(false)
    expect(localDb.getQuotation(quote.id)).toBeNull()
    expect(localDb.getQuotationVersions(quote.id)).toHaveLength(0)

    const raw = JSON.parse(localStorage.getItem(QUOTE_KEY) || '[]') as Array<{
      id: string
      deletedAt?: string | null
      deleteReason?: string | null
    }>
    const kept = raw.find((q) => q.id === quote.id)
    expect(kept?.deletedAt).toBeTruthy()
    expect(kept?.deleteReason).toContain('測試刪除')

    const rawVer = JSON.parse(
      localStorage.getItem(VERSION_KEY) || '[]',
    ) as Array<{ id: string; deletedAt?: string | null }>
    expect(rawVer.find((v) => v.id === version.id)?.deletedAt).toBeTruthy()
  })

  it('已接受案件不可刪除；exported 狀態版本可刪', () => {
    const b = boss()
    const quote = makeQuote(`接受不可刪-${Date.now()}`)
    localDb.addQuotationItem({
      quotationId: quote.id,
      kind: 'material',
      description: '材料',
      qty: 2,
      unit: '個',
      unitPrice: 50,
    })
    const { version } = localDb.exportQuotationVersion(
      { id: b.id, role: b.role },
      quote.id,
      'snapshot',
    )

    localDb.softDeleteQuotationVersion(
      { id: b.id, role: 'admin' },
      version.id,
    )
    expect(localDb.getQuotationVersions(quote.id)).toHaveLength(0)

    localDb.exportQuotationVersion(
      { id: b.id, role: b.role },
      quote.id,
      'pdf',
    )
    localDb.setQuoteWorkflowStatus(
      { id: b.id, role: b.role },
      quote.id,
      'accepted',
    )
    expect(() =>
      localDb.softDeleteQuotation({ id: b.id, role: b.role }, quote.id),
    ).toThrow(/已接受/)
  })

  it('Member 不可刪除案件或版本', () => {
    const b = boss()
    const m = member()
    const quote = makeQuote(`Member不可刪-${Date.now()}`)
    localDb.addQuotationItem({
      quotationId: quote.id,
      kind: 'other',
      description: '雜項',
      qty: 1,
      unitPrice: 100,
    })
    const { version } = localDb.exportQuotationVersion(
      { id: b.id, role: b.role },
      quote.id,
    )
    expect(() =>
      localDb.softDeleteQuotation({ id: m.id, role: m.role }, quote.id),
    ).toThrow(/無權刪除/)
    expect(() =>
      localDb.softDeleteQuotationVersion(
        { id: m.id, role: m.role },
        version.id,
      ),
    ).toThrow(/無權刪除/)
  })
})
