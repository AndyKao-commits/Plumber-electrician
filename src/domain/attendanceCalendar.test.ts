import { describe, expect, it } from 'vitest'
import {
  buildMonthGrid,
  groupAttendanceDays,
  shiftMonth,
} from './attendanceCalendar'

describe('attendanceCalendar', () => {
  it('builds a full week grid for a month', () => {
    // 2026-11-01 is Sunday in Taipei
    const cells = buildMonthGrid(2026, 10)
    expect(cells[0]?.day).toBe('2026-11-01')
    expect(cells.filter((c) => c.inMonth).length).toBe(30)
    expect(cells.length % 7).toBe(0)
  })

  it('shifts months across year boundary', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 })
    expect(shiftMonth(2025, 11, 1)).toEqual({ year: 2026, monthIndex: 0 })
  })

  it('groups attendance by Taipei day', () => {
    const map = groupAttendanceDays([
      { id: 'a', clockInAt: '2026-11-11T04:00:00.000Z' }, // 12:00 Taipei
      { id: 'b', clockInAt: '2026-11-10T16:30:00.000Z' }, // 00:30 next day Taipei
    ])
    expect(map.get('2026-11-11')).toEqual(['a', 'b'])
  })
})
