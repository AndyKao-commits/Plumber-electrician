/** Daily-wage auto calculation from attendance punch totals. */

import { summarizeDayShifts } from '@/domain/attendanceTimeline'
import { groupAttendanceDays } from '@/domain/attendanceCalendar'
import { taipeiDateString } from '@/lib/time'
import type { AttendanceRecord, SalaryEntry } from '@/domain/types'

/** Hours above this count as a full day; otherwise half day. */
export const FULL_DAY_HOURS_THRESHOLD = 4

export type DayWageFraction = 0.5 | 1

export function dayFractionFromWorkMs(workMs: number): DayWageFraction | null {
  if (!Number.isFinite(workMs) || workMs <= 0) return null
  const hours = workMs / 3_600_000
  return hours > FULL_DAY_HOURS_THRESHOLD ? 1 : 0.5
}

export function amountForDayFraction(
  dailyRate: number,
  fraction: DayWageFraction,
): number {
  if (!Number.isFinite(dailyRate) || dailyRate < 0) {
    throw new Error('日薪基準無效')
  }
  return Math.round(dailyRate * fraction)
}

export function dayWageTitle(fraction: DayWageFraction): string {
  return fraction === 1 ? '日薪出勤（整天）' : '日薪出勤（半天）'
}

export type DailyWageDraft = {
  attendanceDate: string
  dayFraction: DayWageFraction
  workMs: number
  amount: number
  title: string
  note: string
}

/**
 * Build pending daily-wage drafts for a month.
 * Only days with closed shifts (no open punch) are generated.
 * Skips dates that already have a non-cancelled attendance_daily base entry.
 */
export function buildDailyWageDrafts(input: {
  attendance: AttendanceRecord[]
  dailyRate: number
  existingEntries: SalaryEntry[]
  /** YYYY-MM-DD; days on/after this are skipped if still open */
  todayTaipei?: string
}): DailyWageDraft[] {
  const today = input.todayTaipei ?? taipeiDateString()
  const byDay = groupAttendanceDays(input.attendance)
  const taken = new Set(
    input.existingEntries
      .filter(
        (e) =>
          e.source === 'attendance_daily' &&
          e.category === 'base' &&
          e.status !== 'cancelled' &&
          e.attendanceDate,
      )
      .map((e) => e.attendanceDate as string),
  )

  const drafts: DailyWageDraft[] = []
  for (const [day, ids] of byDay) {
    if (taken.has(day)) continue
    const records = input.attendance.filter((a) => ids.includes(a.id))
    const summary = summarizeDayShifts(records)
    if (summary.hasOpen && day >= today) continue
    if (summary.hasOpen) continue
    if (summary.totalWorkMs <= 0) continue
    const fraction = dayFractionFromWorkMs(summary.totalWorkMs)
    if (!fraction) continue
    const hours = (summary.totalWorkMs / 3_600_000).toFixed(1)
    drafts.push({
      attendanceDate: day,
      dayFraction: fraction,
      workMs: summary.totalWorkMs,
      amount: amountForDayFraction(input.dailyRate, fraction),
      title: dayWageTitle(fraction),
      note: `自動：當日工時約 ${hours} 小時`,
    })
  }
  return drafts.sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate))
}

export function workDaysFromEntries(entries: SalaryEntry[]): number {
  let days = 0
  for (const e of entries) {
    if (e.status === 'cancelled' || e.status === 'draft') continue
    if (e.status !== 'confirmed' && e.status !== 'paid') continue
    if (e.category !== 'base') continue
    if (e.source === 'attendance_daily') {
      days += e.dayFraction === 0.5 ? 0.5 : 1
    } else if (e.source == null || e.source === 'manual') {
      // manual base lines count as 1 day equivalent only if titled as day wage? skip
    }
  }
  return days
}
