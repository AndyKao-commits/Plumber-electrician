import { describe, expect, it } from 'vitest'
import { localDb } from './localDb'

describe('attendance correction approve overwrites', () => {
  it('overwrites linked attendance on approve', () => {
    const boss = localDb.getUsers().find((u) => u.role === 'boss')!
    const employee = localDb.getUsers().find((u) => u.role === 'employee')!

    const attId = `att-corr-${Date.now()}`
    localDb.saveAttendance({
      id: attId,
      organizationId: employee.organizationId,
      userId: employee.id,
      status: 'clocked_out',
      clockInAt: '2026-11-11T04:00:00.000Z',
      clockOutAt: '2026-11-11T04:05:00.000Z',
      siteId: null,
      jobType: 'project',
    })

    const correction = localDb.applyAttendanceCorrection({
      userId: employee.id,
      attendanceId: attId,
      proposedClockInAt: '2026-11-11T01:00:00.000Z',
      proposedClockOutAt: '2026-11-11T10:00:00.000Z',
      reason: `漏打修正-${Date.now()}`,
    })

    localDb.approveAttendanceCorrection({
      correctionId: correction.id,
      actorId: boss.id,
    })

    const updated = localDb.getAttendance().find((a) => a.id === attId)
    expect(updated?.clockInAt).toBe('2026-11-11T01:00:00.000Z')
    expect(updated?.clockOutAt).toBe('2026-11-11T10:00:00.000Z')
    expect(updated?.status).toBe('clocked_out')
  })
})
