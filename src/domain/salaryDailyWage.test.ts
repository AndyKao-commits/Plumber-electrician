import { describe, expect, it } from 'vitest'
import type { AttendanceRecord, SalaryEntry } from './types'
import {
  amountForDayFraction,
  buildDailyWageDrafts,
  dayFractionFromWorkMs,
} from './salaryDailyWage'

describe('salaryDailyWage', () => {
  it('>4h = full day, ≤4h = half', () => {
    expect(dayFractionFromWorkMs(4 * 3_600_000)).toBe(0.5)
    expect(dayFractionFromWorkMs(4 * 3_600_000 + 1)).toBe(1)
    expect(dayFractionFromWorkMs(8 * 3_600_000)).toBe(1)
    expect(dayFractionFromWorkMs(0)).toBeNull()
  })

  it('amounts round from daily rate', () => {
    expect(amountForDayFraction(2500, 1)).toBe(2500)
    expect(amountForDayFraction(2500, 0.5)).toBe(1250)
  })

  it('sums same-day punches then applies rule', () => {
    const attendance: AttendanceRecord[] = [
      {
        id: 'a1',
        organizationId: 'o',
        userId: 'u',
        status: 'clocked_out',
        clockInAt: '2026-11-10T01:00:00.000Z', // 09:00 Taipei
        clockOutAt: '2026-11-10T04:00:00.000Z', // 12:00 → 3h
      },
      {
        id: 'a2',
        organizationId: 'o',
        userId: 'u',
        status: 'clocked_out',
        clockInAt: '2026-11-10T05:00:00.000Z',
        clockOutAt: '2026-11-10T07:30:00.000Z', // +2.5h = 5.5h total → full
      },
    ]
    const drafts = buildDailyWageDrafts({
      attendance,
      dailyRate: 2500,
      existingEntries: [],
      todayTaipei: '2026-11-17',
    })
    expect(drafts).toHaveLength(1)
    expect(drafts[0].dayFraction).toBe(1)
    expect(drafts[0].amount).toBe(2500)
  })

  it('skips days that already have attendance_daily entry', () => {
    const attendance: AttendanceRecord[] = [
      {
        id: 'a1',
        organizationId: 'o',
        userId: 'u',
        status: 'clocked_out',
        clockInAt: '2026-11-10T01:00:00.000Z',
        clockOutAt: '2026-11-10T06:00:00.000Z',
      },
    ]
    const existing = [
      {
        source: 'attendance_daily',
        category: 'base',
        status: 'pending',
        attendanceDate: '2026-11-10',
      },
    ] as SalaryEntry[]
    expect(
      buildDailyWageDrafts({
        attendance,
        dailyRate: 2500,
        existingEntries: existing,
        todayTaipei: '2026-11-17',
      }),
    ).toHaveLength(0)
  })
})
