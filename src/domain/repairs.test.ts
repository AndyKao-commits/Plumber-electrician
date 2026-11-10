import { describe, expect, it } from 'vitest'
import {
  assertProblemDescription,
  canCreateRepairWithProblemOnly,
  nextRepairStatusAfterDispatch,
  nextRepairStatusAfterVisit,
  visitCreatesAttendance,
} from './repairs'

describe('REP-001 維修案件', () => {
  it('只需問題描述可建立；不強制客戶或工地', () => {
    expect(assertProblemDescription('  廚房漏水  ')).toBe('廚房漏水')
    expect(
      canCreateRepairWithProblemOnly({ problemDescription: '廚房漏水' }),
    ).toEqual({ ok: true, problemDescription: '廚房漏水' })
    expect(
      canCreateRepairWithProblemOnly({ problemDescription: '' }).ok,
    ).toBe(false)
  })

  it('派工／到場推進狀態；到場不產生出勤', () => {
    expect(nextRepairStatusAfterDispatch('pending_schedule')).toBe('scheduled')
    expect(nextRepairStatusAfterVisit('scheduled')).toBe('in_progress')
    expect(visitCreatesAttendance()).toBe(false)
  })
})
