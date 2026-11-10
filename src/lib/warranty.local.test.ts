import { describe, expect, it } from 'vitest'
import { isFullyFreeWarranty, requiresChargeAfterAssessment } from '@/domain/warranty'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb WAR-001', () => {
  it('保固期內排除項目不自動免費；判定需理由', () => {
    const b = boss()
    const repair = localDb.createRepairCase(
      { id: b.id, name: b.name },
      { problemDescription: `保固測試-${Date.now()}` },
    )
    const war = localDb.createWarranty(
      { id: b.id },
      {
        title: '一年保固',
        repairCaseId: repair.id,
        startsOn: '2026-01-01',
        endsOn: '2027-01-01',
        exclusionNotes: '人為損壞',
      },
    )
    expect(() =>
      localDb.createWarrantyAssessment(
        { id: b.id, name: b.name },
        {
          repairCaseId: repair.id,
          warrantyId: war.id,
          classification: 'excluded',
          rationale: '',
        },
      ),
    ).toThrow(/理由/)

    const a = localDb.createWarrantyAssessment(
      { id: b.id, name: b.name },
      {
        repairCaseId: repair.id,
        warrantyId: war.id,
        classification: 'excluded',
        rationale: '人為損壞屬排除項目',
      },
    )
    expect(requiresChargeAfterAssessment(a.classification)).toBe(true)
    expect(isFullyFreeWarranty(a.classification)).toBe(false)
    expect(localDb.listWarrantyAssessments(repair.id)).toHaveLength(1)
  })
})
