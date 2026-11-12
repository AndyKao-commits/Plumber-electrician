import { taipeiDateString } from '@/lib/time'

export type CalendarCell = {
  /** YYYY-MM-DD in Asia/Taipei; null = empty padding cell */
  day: string | null
  inMonth: boolean
}

/** Build a Sun–Sat month grid for the given Taipei calendar month. */
export function buildMonthGrid(
  year: number,
  monthIndex: number,
): CalendarCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1, 4, 0, 0))
  // Use noon UTC+8 approximation via constructing local-like ISO
  const firstDay = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
  const firstWeekday = weekdaySun0(firstDay) // 0=Sun
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const cells: CalendarCell[] = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: null, inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, inMonth: false })
  }
  void first
  return cells
}

function weekdaySun0(day: string): number {
  // Parse as Taipei midnight → get weekday
  const dt = new Date(`${day}T12:00:00+08:00`)
  return dt.getUTCDay() // at +08 noon, UTC is 04:00 same calendar day → getUTCDay == Taipei weekday
}

export function shiftMonth(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; monthIndex: number } {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1))
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() }
}

export function groupAttendanceDays(
  records: { id: string; clockInAt: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const r of records) {
    const day = taipeiDateString(r.clockInAt)
    const list = map.get(day) ?? []
    list.push(r.id)
    map.set(day, list)
  }
  return map
}

export function currentTaipeiYearMonth(now = new Date()): {
  year: number
  monthIndex: number
} {
  const y = Number(taipeiDateString(now).slice(0, 4))
  const m = Number(taipeiDateString(now).slice(5, 7)) - 1
  return { year: y, monthIndex: m }
}
