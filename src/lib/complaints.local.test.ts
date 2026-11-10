import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb COM-001', () => {
  it('可不關聯工程建立客訴；關聯不刪除案件', () => {
    const b = boss()
    const cmp = localDb.createComplaint(
      { id: b.id },
      { subject: `客訴-${Date.now()}` },
    )
    expect(cmp.siteId ?? null).toBeNull()
    expect(cmp.repairCaseId ?? null).toBeNull()

    const a = localDb.createRepairCase(
      { id: b.id, name: b.name },
      { problemDescription: `重複A-${Date.now()}` },
    )
    const c = localDb.createRepairCase(
      { id: b.id, name: b.name },
      { problemDescription: `重複B-${Date.now()}` },
    )
    const before = localDb.getRepairCases().length
    localDb.linkRelatedRepairCases(
      { id: b.id },
      { fromRepairCaseId: a.id, toRepairCaseId: c.id, note: '同址再報修' },
    )
    expect(localDb.getRepairCases().length).toBe(before)
    expect(localDb.getRepairCase(a.id)).toBeTruthy()
    expect(localDb.getRepairCase(c.id)).toBeTruthy()
    expect(localDb.listRelatedRepairCases(a.id)).toHaveLength(1)
  })
})
