import { describe, expect, it } from 'vitest'
import { canQuoteRepairWithoutProject } from '@/domain/materialUsage'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb REP-002', () => {
  it('耗用扣庫存一次；可轉無工程維修報價', () => {
    const b = boss()
    const mat = localDb.getMaterials()[0]
    if (!mat) throw new Error('no material')
    const beforeQty = mat.qty
    const repair = localDb.createRepairCase(
      { id: b.id, name: b.name },
      { problemDescription: `耗用測試-${Date.now()}` },
    )
    const op = `op-${Date.now()}`
    const usage = localDb.postMaterialUsage(
      { id: b.id },
      {
        materialId: mat.id,
        qty: 2,
        repairCaseId: repair.id,
        clientOperationId: op,
      },
    )
    expect(usage.totalCost).toBeGreaterThan(0)
    expect(localDb.getMaterials().find((m) => m.id === mat.id)?.qty).toBe(
      beforeQty - 2,
    )
    expect(() =>
      localDb.postMaterialUsage(
        { id: b.id },
        {
          materialId: mat.id,
          qty: 1,
          repairCaseId: repair.id,
          clientOperationId: op,
        },
      ),
    ).toThrow(/只扣一次/)

    const quote = localDb.createQuoteFromRepairUsages(
      { id: b.id, role: b.role },
      { repairCaseId: repair.id },
    )
    expect(canQuoteRepairWithoutProject(quote)).toBe(true)
    expect(quote.repairCaseId).toBe(repair.id)
    expect(quote.projectId ?? null).toBeNull()
    expect(localDb.getQuotationItems(quote.id).length).toBeGreaterThan(0)
  })
})
