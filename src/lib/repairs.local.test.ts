import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

function boss() {
  const u = localDb.getUsers().find((x) => x.role === 'boss')
  if (!u) throw new Error('no boss')
  return u
}

describe('localDb REP-001', () => {
  it('只需問題可建；多次派工／到場保留；到場不建出勤', () => {
    const b = boss()
    const beforeAttendance = localDb.getAttendance().length
    const repair = localDb.createRepairCase(
      { id: b.id, name: b.name },
      { problemDescription: `水龍頭滴水-${Date.now()}` },
    )
    expect(repair.customerName ?? null).toBeNull()
    expect(repair.status).toBe('pending_schedule')

    localDb.assignRepair(
      { id: b.id, name: b.name },
      {
        repairCaseId: repair.id,
        assigneeUserId: b.id,
        assigneeName: b.name,
        note: '第一次派工',
      },
    )
    localDb.assignRepair(
      { id: b.id, name: b.name },
      {
        repairCaseId: repair.id,
        assigneeUserId: b.id,
        assigneeName: b.name,
        note: '第二次派工',
      },
    )
    expect(localDb.listRepairAssignments(repair.id)).toHaveLength(2)
    expect(localDb.getRepairCase(repair.id)?.status).toBe('scheduled')

    const visit = localDb.recordRepairVisit(
      { id: b.id, name: b.name },
      { repairCaseId: repair.id, note: '到場檢查' },
    )
    expect(visit.attendanceCreated).toBe(false)
    expect(localDb.getAttendance().length).toBe(beforeAttendance)
    expect(localDb.getRepairCase(repair.id)?.status).toBe('in_progress')
    expect(localDb.listRepairVisits(repair.id)).toHaveLength(1)
  })
})
